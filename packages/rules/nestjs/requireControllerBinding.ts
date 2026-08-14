// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// NestJS: a @Controller() class only participates in the app when the
// module that owns it lists it in `controllers: [...]` — which requires the
// module file to import the controller class. A controller file that no
// *.module.* file imports is therefore never bound to the module graph, and
// its routes are dead. The import IS the binding (NestJS modules cannot
// reference a class they don't import), so checking imports is checking the
// real mechanism, not a naming heuristic.
const CONTROLLER_FILE_PATTERN = /\.controller\.(ts|js)$/;
const MODULE_FILE_PATTERN = /\.module\.(ts|js)$/;

export const requireControllerBinding: Rule = {
  id: "nestjs/require-controller-binding",
  description: "Every *.controller.* file must be imported by at least one *.module.* file",
  appliesToFramework: "nestjs",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const module of repository.getAllModules()) {
      const path = module.file.relativePath;
      if (!CONTROLLER_FILE_PATTERN.test(path)) continue;

      const boundToModule = module.importedBy.some((importerId) => MODULE_FILE_PATTERN.test(importerId));
      if (boundToModule) continue;

      violations.push({
        ruleId: requireControllerBinding.id,
        message: `"${path}" is not imported by any *.module.* file — the controller is never bound to the NestJS module graph`,
        filePath: path,
        severity: "warning",
      });
    }

    return violations;
  },
};
