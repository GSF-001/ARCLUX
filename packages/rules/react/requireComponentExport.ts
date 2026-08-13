// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// PascalCase .tsx/.jsx files are the repo's component convention (same
// heuristic as detectComponentConvention.ts / calculateAffectedComponents.ts).
const COMPONENT_FILE_PATTERN = /(^|\/)[A-Z][A-Za-z0-9]*\.(tsx|jsx)$/;

// Next.js App Router files are covered by the nextjs/* rules; a page.tsx
// with no exports is a routing-convention issue, not a component one.
const FRAMEWORK_CONVENTION_FILENAME = /(^|\/)(page|layout|loading|error|not-found|route|template|default)\.(tsx|jsx)$/;

export const requireComponentExport: Rule = {
  id: "react/require-component-export",
  description: "React component files (.tsx/.jsx, PascalCase) must export a component",
  appliesToFramework: "react",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const module of repository.getAllModules()) {
      const path = module.file.relativePath;
      if (!COMPONENT_FILE_PATTERN.test(path)) continue;
      if (FRAMEWORK_CONVENTION_FILENAME.test(path)) continue;
      if (module.exports.length > 0) continue;

      violations.push({
        ruleId: requireComponentExport.id,
        message: `"${path}" exports nothing — a React component file should export a component (default or named)`,
        filePath: path,
        severity: "warning",
      });
    }

    return violations;
  },
};
