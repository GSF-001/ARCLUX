// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import { traceConsumers } from "./traceConsumers";

export interface AffectedFile {
  moduleId: string;
  filePath: string;
  distance: number;
}

export interface ImpactResult {
  changedModuleId: string;
  notFound: boolean;
  affectedFiles: AffectedFile[];
  totalAffected: number;
}

export function calculateAffectedFiles(repository: Repository, moduleId: string): ImpactResult {
  const trace = traceConsumers(repository, moduleId);

  if (trace.notFound) {
    return { changedModuleId: moduleId, notFound: true, affectedFiles: [], totalAffected: 0 };
  }

  const distances = new Map<string, number>();
  const queue: Array<{ id: string; distance: number }> = trace.direct.map((id) => ({ id, distance: 1 }));
  const visited = new Set<string>([moduleId]);

  while (queue.length > 0) {
    const { id, distance } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    distances.set(id, distance);

    const module = repository.getModule(id);
    if (!module) continue;
    for (const consumer of module.importedBy) {
      if (!visited.has(consumer)) queue.push({ id: consumer, distance: distance + 1 });
    }
  }

  const affectedFiles: AffectedFile[] = trace.transitive
    .map((id) => {
      const module = repository.getModule(id);
      return {
        moduleId: id,
        filePath: module?.file.relativePath ?? id,
        distance: distances.get(id) ?? -1,
      };
    })
    .sort((a, b) => a.distance - b.distance);

  return {
    changedModuleId: moduleId,
    notFound: false,
    affectedFiles,
    totalAffected: affectedFiles.length,
  };
}
