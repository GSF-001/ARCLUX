// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// NestJS module graph: the application is assembled from @Module classes,
// starting at the root (app.module.ts). A feature module only takes effect
// if it is imported by another module that is itself reachable from the
// root — an orphan *.module.* file that no other module imports is dead
// configuration: none of its controllers/providers are ever instantiated.
//
// This rule is the module-level counterpart to requireControllerBinding
// (which checks individual controllers). It walks the import graph from the
// root module, following only *.module.* imports, and flags every module
// file that is not reachable.
const MODULE_FILE_PATTERN = /\.module\.(ts|js)$/;
const ROOT_MODULE_PATTERN = /(^|\/)app\.module\.(ts|js)$/;

export const requireModuleRegistration: Rule = {
  id: "nestjs/require-module-registration",
  description: "Every *.module.* file must be reachable from the root module (app.module.ts)",
  appliesToFramework: "nestjs",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const moduleFiles = repository
      .getAllModules()
      .filter((m) => MODULE_FILE_PATTERN.test(m.file.relativePath));

    if (moduleFiles.length === 0) return [];

    const root = moduleFiles.find((m) => ROOT_MODULE_PATTERN.test(m.file.relativePath));

    // No root module at all: flag every module file that no other module
    // file imports (each of them might be someone's intended root).
    if (!root) {
      for (const module of moduleFiles) {
        const importedByModule = module.importedBy.some((id) => MODULE_FILE_PATTERN.test(id));
        if (!importedByModule) {
          violations.push({
            ruleId: requireModuleRegistration.id,
            message: `No root app.module.ts found; "${module.file.relativePath}" is not imported by any other *.module.* file`,
            filePath: module.file.relativePath,
            severity: "warning",
          });
        }
      }
      return violations;
    }

    // BFS from the root module over module-file imports only.
    const reachable = new Set<string>([root.id]);
    const queue = [root.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const module = repository.getModule(id);
      if (!module) continue;
      for (const importedId of module.imports) {
        if (!MODULE_FILE_PATTERN.test(importedId)) continue;
        if (reachable.has(importedId)) continue;
        reachable.add(importedId);
        queue.push(importedId);
      }
    }

    for (const module of moduleFiles) {
      if (module.id === root.id || reachable.has(module.id)) continue;
      violations.push({
        ruleId: requireModuleRegistration.id,
        message: `"${module.file.relativePath}" is not reachable from app.module.ts — the module is never registered`,
        filePath: module.file.relativePath,
        severity: "warning",
      });
    }

    return violations;
  },
};
