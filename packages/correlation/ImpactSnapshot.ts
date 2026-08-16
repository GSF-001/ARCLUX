// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Normalized impact view over the core impact package. The task
// description asked for an "ImpactReport" input — this adapter is what
// actually provides it, wrapping impact/calculateAffectedFiles without
// modifying core. Consumers of the bridge get one stable shape regardless
// of which impact/* function produced the numbers.

import type { Repository } from "../repository/Repository";
import { calculateAffectedFiles } from "../impact/calculateAffectedFiles";

export interface ImpactedFile {
  moduleId: string;
  filePath: string;
  /** Hop distance from the changed module (1 = direct consumer). */
  distance: number;
}

export interface ImpactSnapshot {
  changedModuleId: string;
  notFound: boolean;
  affectedFiles: ImpactedFile[];
  totalAffected: number;
}

export function buildImpactSnapshot(repository: Repository, moduleId: string): ImpactSnapshot {
  const result = calculateAffectedFiles(repository, moduleId);
  return {
    changedModuleId: result.changedModuleId,
    notFound: result.notFound,
    affectedFiles: result.affectedFiles.map((f) => ({ moduleId: f.moduleId, filePath: f.filePath, distance: f.distance })),
    totalAffected: result.totalAffected,
  };
}
