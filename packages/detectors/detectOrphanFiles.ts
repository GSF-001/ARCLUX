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

export interface OrphanFileFinding {
  filePath: string;
  message: string;
}

/**
 * Files that nothing else in the repository imports at all — file-level,
 * distinct from detectUnusedExports.ts which checks per-export.
 *
 * Same limitation as detectUnusedExports.ts: no entry-file concept exists
 * yet (resolveRoutes.ts is still empty). A file that's genuinely an entry
 * point (a CLI's index.ts, a Next.js page.tsx never imported by other
 * source files) will show up here as a false positive. Revisit once
 * resolveRoutes.ts / an explicit entry-file list exists.
 */
export function detectOrphanFiles(repository: Repository): OrphanFileFinding[] {
  return repository.findModulesWithNoImporters().map((module) => ({
    filePath: module.file.relativePath,
    message: `"${module.file.relativePath}" is never imported by any other file in the repository.`,
  }));
}
