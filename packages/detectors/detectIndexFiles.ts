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

export interface IndexFileFinding {
  filePath: string;
  reExportCount: number;
  totalExportCount: number;
  isPureBarrel: boolean;
  message: string;
}

const INDEX_FILENAME_PATTERN = /(^|\/)index\.(ts|tsx|js|jsx)$/;

/**
 * Finds barrel files (index.ts/tsx files whose job is re-exporting other
 * modules) and reports how "pure" each one is — 100% re-exports vs. a mix
 * of re-exports and its own definitions. A file named index.ts that ALSO
 * defines real logic (not just re-exporting) is a common source of
 * confusion in larger codebases; this surfaces that pattern rather than
 * silently treating all index.ts files the same way.
 *
 * Only classifies existing exports by RawExport.kind === "re-export" —
 * does not attempt to guess intent for files with zero exports.
 */
export function detectIndexFiles(repository: Repository): IndexFileFinding[] {
  const findings: IndexFileFinding[] = [];

  for (const module of repository.getAllModules()) {
    if (!INDEX_FILENAME_PATTERN.test(module.file.relativePath)) continue;
    if (module.exports.length === 0) continue;

    const reExportCount = module.exports.filter((e) => e.kind === "re-export").length;
    const totalExportCount = module.exports.length;
    const isPureBarrel = reExportCount === totalExportCount;

    findings.push({
      filePath: module.file.relativePath,
      reExportCount,
      totalExportCount,
      isPureBarrel,
      message: isPureBarrel
        ? `"${module.file.relativePath}" is a pure barrel file (${totalExportCount}/${totalExportCount} exports are re-exports).`
        : `"${module.file.relativePath}" mixes re-exports (${reExportCount}) with its own definitions (${totalExportCount - reExportCount}) — consider splitting.`,
    });
  }

  return findings;
}
