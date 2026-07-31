// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";

export interface CircularDependency {
  cycle: string[];
}

export function detectCircularDependency(repository: Repository): CircularDependency[] {
  const circular: CircularDependency[] = [];
  const resolved = new Set<string>();
  const unresolved = new Set<string>();
  const stack: string[] = [];

  function resolve(moduleId: string) {
    if (resolved.has(moduleId)) return;

    unresolved.add(moduleId);
    stack.push(moduleId);

    const module = repository.getModule(moduleId);
    if (module) {
      for (const dependencyId of module.imports) {
        if (resolved.has(dependencyId)) continue;

        if (unresolved.has(dependencyId)) {
          const cycleStart = stack.indexOf(dependencyId);
          circular.push({ cycle: [...stack.slice(cycleStart), dependencyId] });
          continue;
        }

        resolve(dependencyId);
      }
    }

    resolved.add(moduleId);
    unresolved.delete(moduleId);
    stack.pop();
  }

  for (const module of repository.getAllModules()) {
    resolve(module.id);
  }

  return circular;
}
