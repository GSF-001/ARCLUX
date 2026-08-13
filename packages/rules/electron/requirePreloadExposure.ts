// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// Electron preload wiring: a preload script (preload.ts / preload.js) only
// takes effect if the main process loads it via
// `new BrowserWindow({ webPreferences: { preload: <path> } })` — which
// requires the main entry to import/reference the file. A preload script
// that nothing imports is dead: its contextBridge API is never exposed.
//
// Absence of any preload script is NOT flagged — many Electron apps run
// without context isolation bridges entirely. Only "exists but never
// loaded" is a problem.
const PRELOAD_FILE_PATTERN = /(^|\/)preload\.(ts|js)$/;

export const requirePreloadExposure: Rule = {
  id: "electron/require-preload-exposure",
  description: "Preload scripts must be imported (loaded) by the main process",
  appliesToFramework: "electron",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const module of repository.getAllModules()) {
      const path = module.file.relativePath;
      if (!PRELOAD_FILE_PATTERN.test(path)) continue;

      if (module.importedBy.length > 0) continue;

      violations.push({
        ruleId: requirePreloadExposure.id,
        message: `"${path}" is never imported — the main process never loads it, so its contextBridge API is never exposed`,
        filePath: path,
        severity: "warning",
      });
    }

    return violations;
  },
};
