// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// Hook files follow React's naming rule: a useXxx.ts file must export a
// hook named useXxx. Without that, other modules import the file and the
// hooks-rules lint cannot even associate the file with a hook name.
const HOOK_FILE_PATTERN = /(^|\/)use[A-Z][A-Za-z0-9]*\.(ts|tsx)$/;

export const requireHookRules: Rule = {
  id: "react/require-hook-rules",
  description: "A useXxx.ts hook file must export a hook named useXxx",
  appliesToFramework: "react",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const module of repository.getAllModules()) {
      const path = module.file.relativePath;
      if (!HOOK_FILE_PATTERN.test(path)) continue;

      const filename = path.split("/").pop() ?? "";
      const expectedHookName = filename.replace(/\.(ts|tsx)$/, "");

      const hasMatchingExport = module.exports.some((exp) => exp.name === expectedHookName);
      if (!hasMatchingExport) {
        violations.push({
          ruleId: requireHookRules.id,
          message: `"${path}" exports nothing named "${expectedHookName}" — React hooks must be exported with a useXxx name`,
          filePath: path,
          severity: "warning",
        });
      }
    }

    return violations;
  },
};
