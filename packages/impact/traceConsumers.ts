// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";

export interface ConsumerTraceResult {
  direct: string[];
  transitive: string[];
  notFound: boolean;
}

export function traceConsumers(repository: Repository, moduleId: string): ConsumerTraceResult {
  const startModule = repository.getModule(moduleId);
  if (!startModule) {
    return { direct: [], transitive: [], notFound: true };
  }

  const direct = [...startModule.importedBy];
  const visited = new Set<string>([moduleId]);
  const transitive: string[] = [];
  const queue = [...direct];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    transitive.push(current);

    const module = repository.getModule(current);
    if (!module) continue;

    for (const consumer of module.importedBy) {
      if (!visited.has(consumer)) queue.push(consumer);
    }
  }

  return { direct, transitive, notFound: false };
}
