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
import { detectEntryPoints } from "./detectEntryPoints";
import { getEntryModuleIds } from "../indexer/resolveRoutes";

export interface OrphanFileFinding {
  filePath: string;
  message: string;
}

/**
 * Files that nothing else in the repository imports at all — file-level,
 * distinct from detectUnusedExports.ts which checks per-export.
 *
 * Entry points are excluded up front: a CLI's index.ts or a Next.js
 * page.tsx is never imported by other source files BY DESIGN — it's
 * invoked by the runtime/framework, so it's not an orphan. The exclusion
 * set comes from indexer/resolveRoutes.ts (App Router convention) plus
 * detectEntryPoints.ts (known entry-point conventions), mirroring what
 * detectUnusedExports.ts does.
 */
export function detectOrphanFiles(repository: Repository): OrphanFileFinding[] {
  const entryModuleIds = new Set<string>();
  for (const id of getEntryModuleIds(repository.getAllModules())) entryModuleIds.add(id);
  for (const finding of detectEntryPoints(repository)) entryModuleIds.add(finding.filePath);

  return repository
    .findModulesWithNoImporters()
    .filter((module) => !entryModuleIds.has(module.id))
    .map((module) => ({
      filePath: module.file.relativePath,
      message: `"${module.file.relativePath}" is never imported by any other file in the repository.`,
    }));
}
