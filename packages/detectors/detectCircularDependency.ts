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

// Cycles are recorded once per unique node set, not once per entry point
// the outer loop happens to reach first -- without this, an N-node cycle
// gets reported N times (once from each node still unresolved when the
// outer loop visits it), since the same cycle rotated to start at a
// different node looks like a different array. Rotate to a canonical
// starting point (lexicographically smallest node) before deduping.
// Contributed by ManSio, issue #207.
function canonicalizeCycle(cycle: string[]): string {
  const nodes = cycle.slice(0, -1);
  let minIdx = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i] < nodes[minIdx]) minIdx = i;
  }
  const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];
  return [...rotated, rotated[0]].join("\0");
}

export function detectCircularDependency(repository: Repository): CircularDependency[] {
  const circular: CircularDependency[] = [];
  const resolved = new Set<string>();
  const unresolved = new Set<string>();
  const seenCycles = new Set<string>();
  const stack: string[] = [];

  function resolve(moduleId: string) {
    if (resolved.has(moduleId)) return;

    unresolved.add(moduleId);
    stack.push(moduleId);

    const module = repository.getModule(moduleId);
    if (module) {
      // Type-only edges (TS `import type`, Python `if TYPE_CHECKING:`) are
      // compile-time dependencies, not runtime edges — a cycle closed only
      // through type-only imports is not a runtime cycle. Mirrors
      // dependency-cruiser's `no-circular-at-runtime` rule
      // (viaOnly.dependencyTypesNot: ["type-only"]). Decision #458, Variant C.
      const typeOnlyTargets = new Set(
        (module.resolvedImports ?? [])
          .filter((r) => r.kind === "type-only")
          .map((r) => r.moduleId)
      );

      for (const dependencyId of module.imports) {
        if (typeOnlyTargets.has(dependencyId)) continue;
        if (resolved.has(dependencyId)) continue;

        if (unresolved.has(dependencyId)) {
          const cycleStart = stack.indexOf(dependencyId);
          const cycle = [...stack.slice(cycleStart), dependencyId];
          const key = canonicalizeCycle(cycle);
          if (!seenCycles.has(key)) {
            seenCycles.add(key);
            circular.push({ cycle });
          }
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
