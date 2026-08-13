// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// Vite wiring: the default entry contract is `index.html` (at the repo
// root, referencing /src/main.*) plus an optional vite.config.*. The
// parser does not index .html files, so the two checkable signals here are
// the config file and the conventional entry script src/main.(tsx|ts|jsx|js).
// Both are convention-level (Vite can technically run without them in
// unusual setups), hence warning severity.
const VITE_CONFIG_PATTERN = /(^|\/)vite\.config\.(ts|mts|js|mjs|cjs)$/;
const DEFAULT_ENTRY_PATTERN = /^src\/main\.(tsx|ts|jsx|js)$/;

export const requireEntryConfig: Rule = {
  id: "vite/require-entry-config",
  description: "Vite apps should have a vite.config.* and the default entry src/main.*",
  appliesToFramework: "vite",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const paths = repository.getAllModules().map((m) => m.file.relativePath);

    const hasConfig = paths.some((p) => VITE_CONFIG_PATTERN.test(p));
    if (!hasConfig) {
      violations.push({
        ruleId: requireEntryConfig.id,
        message: `No vite.config.* found — the app relies on zero-config defaults`,
        filePath: "vite.config.ts",
        severity: "warning",
      });
    }

    const hasEntry = paths.some((p) => DEFAULT_ENTRY_PATTERN.test(p));
    if (!hasEntry) {
      violations.push({
        ruleId: requireEntryConfig.id,
        message: `No default Vite entry (src/main.tsx|ts|jsx|js) found — index.html has nothing to load`,
        filePath: "src/main.tsx",
        severity: "warning",
      });
    }

    return violations;
  },
};
