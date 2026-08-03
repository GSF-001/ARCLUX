// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Original ARCLUX logic, not adapted from any external source.
//
// Complements detectIndexFiles.ts (which classifies existing barrel files
// as pure/mixed) by looking at what's NOT in the barrel: sibling files in
// the same folder as an index.ts that the index.ts doesn't re-export at
// all. Not necessarily a bug — some sibling files are meant to be
// folder-internal — but a common accidental-omission pattern when a new
// file is added to a folder and the barrel update is forgotten.

import type { Repository } from "../repository/Repository";

export interface MissingExportFinding {
  folderPath: string;
  filePath: string;
  message: string;
}

const INDEX_FILENAME_PATTERN = /(^|\/)index\.(ts|tsx|js|jsx)$/;

function directoryOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

export function detectMissingExports(repository: Repository): MissingExportFinding[] {
  const findings: MissingExportFinding[] = [];
  const modules = repository.getAllModules();

  const indexModules = modules.filter((m) => INDEX_FILENAME_PATTERN.test(m.file.relativePath));

  for (const indexModule of indexModules) {
    const folderPath = directoryOf(indexModule.file.relativePath);
    const reExportedModuleIds = new Set(Object.values(indexModule.resolvedReExports));

    const siblings = modules.filter((m) => {
      if (m.id === indexModule.id) return false;
      return directoryOf(m.file.relativePath) === folderPath;
    });

    for (const sibling of siblings) {
      if (reExportedModuleIds.has(sibling.id)) continue;
      if (sibling.exports.length === 0) continue; // nothing to re-export anyway

      findings.push({
        folderPath,
        filePath: sibling.file.relativePath,
        message: `"${sibling.file.relativePath}" is not re-exported by "${indexModule.file.relativePath}" in the same folder.`,
      });
    }
  }

  return findings;
}
