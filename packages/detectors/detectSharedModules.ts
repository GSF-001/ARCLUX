// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Original ARCLUX logic, not adapted from any external source.

import type { Repository } from "../repository/Repository";

export interface SharedModuleFinding {
  filePath: string;
  importerCount: number;
  message: string;
}

const DEFAULT_MIN_IMPORTERS = 5;

/**
 * Flags high fan-in modules — files imported by many other files. This is
 * informational, not necessarily a problem: shared utility/type files are
 * SUPPOSED to have high fan-in. The value is surfacing "these are the
 * files where a breaking change has the widest blast radius", which pairs
 * naturally with packages/impact/traceConsumers.ts (same importedBy data,
 * different framing: this ranks across the whole repo, traceConsumers
 * looks at one file at a time).
 */
export function detectSharedModules(
  repository: Repository,
  minImporters: number = DEFAULT_MIN_IMPORTERS
): SharedModuleFinding[] {
  const findings: SharedModuleFinding[] = [];

  for (const module of repository.getAllModules()) {
    if (module.importedBy.length >= minImporters) {
      findings.push({
        filePath: module.file.relativePath,
        importerCount: module.importedBy.length,
        message: `"${module.file.relativePath}" is imported by ${module.importedBy.length} other files.`,
      });
    }
  }

  return findings.sort((a, b) => b.importerCount - a.importerCount);
}
