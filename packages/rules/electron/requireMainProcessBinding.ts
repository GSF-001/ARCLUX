// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// Electron: the app is launched by the main-process entry point, and
// package.json's "main" field must point at it. The Repository does not
// expose package.json content, so this rule checks the de-facto standard
// locations for the entry file. Electron refuses to start without a main
// script, so a missing entry is error severity (build/runtime-breaking).
const MAIN_ENTRY_PATTERNS = [
  /^main\.(ts|js)$/, // <root>/main.ts
  /^electron\/main\.(ts|js)$/, // <root>/electron/main.ts
  /^electron\/index\.(ts|js)$/, // <root>/electron/index.ts
  /^src\/main\.(ts|js)$/, // <root>/src/main.ts
  /^src\/electron\/main\.(ts|js)$/, // <root>/src/electron/main.ts
];

export const requireMainProcessBinding: Rule = {
  id: "electron/require-main-process-binding",
  description: "Electron apps must have a main-process entry point (main.ts / electron/main.ts / ...)",
  appliesToFramework: "electron",

  check(repository: Repository): RuleViolation[] {
    const hasMainEntry = repository.getAllModules().some((m) =>
      MAIN_ENTRY_PATTERNS.some((pattern) => pattern.test(m.file.relativePath))
    );

    if (hasMainEntry) return [];

    return [
      {
        ruleId: requireMainProcessBinding.id,
        message: `No main-process entry point found (main.ts, electron/main.ts, electron/index.ts, src/main.ts, ...) — check package.json "main"`,
        filePath: "main.ts",
        severity: "error",
      },
    ];
  },
};
