// Copyright 2026 ARCLUX
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Wraps packages/diff/architecturalDiff.ts (existing) and layers per-module
// impact on top via packages/impact/calculateAffectedFiles.ts (existing).
// Does not reimplement graph traversal.

import type { Repository } from "../repository/Repository";
import { computeArchitecturalDiff } from "../diff/architecturalDiff";
import { calculateAffectedFiles, type ImpactResult } from "../impact/calculateAffectedFiles";

export interface DependencyDiffResult {
  changedFiles: string[];
  affectedModules: string[];
  impactByModule: Record<string, ImpactResult>;
}

export function computeDependencyDiff(
  repository: Repository,
  repoPath: string,
  refA: string,
  refB: string
): DependencyDiffResult {
  const archDiff = computeArchitecturalDiff(repository, repoPath, refA, refB);

  const impactByModule: Record<string, ImpactResult> = {};
  for (const changed of archDiff.changedFiles) {
    if (changed.status === "deleted") continue;
    if (!repository.getModule(changed.path)) continue;
    impactByModule[changed.path] = calculateAffectedFiles(repository, changed.path);
  }

  return {
    changedFiles: archDiff.changedFiles.map((c) => c.path),
    affectedModules: archDiff.affectedFiles,
    impactByModule,
  };
}
