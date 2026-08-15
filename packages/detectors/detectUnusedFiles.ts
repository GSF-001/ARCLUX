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
// The follow-up detectEntryPoints.ts's own comment flagged as not-done-yet:
// wiring entry-point classification in to suppress false positives from
// detectOrphanFiles.ts. This IS that follow-up — a separate detector
// rather than modifying detectOrphanFiles.ts directly, so that detector
// keeps its original meaning ("nothing imports this, full stop") for
// callers that want the unfiltered signal, while this one answers the more
// actionable question: "orphaned AND not a recognized entry point."

import type { Repository } from "../repository/Repository";
import { detectEntryPoints } from "./detectEntryPoints";
import { isTestFilePath } from "./testFiles";

export interface UnusedFileFinding {
  filePath: string;
  message: string;
}

export function detectUnusedFiles(repository: Repository): UnusedFileFinding[] {
  const entryPointPaths = new Set(detectEntryPoints(repository).map((f) => f.filePath));

  return repository
    .findModulesWithNoImporters()
    .filter(
      (module) =>
        !entryPointPaths.has(module.file.relativePath) && !isTestFilePath(module.file.relativePath)
    )
    .map((module) => ({
      filePath: module.file.relativePath,
      message: `"${module.file.relativePath}" is never imported and doesn't match any known entry-point convention.`,
    }));
}
