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
// Package-level counterpart to detectCircularDependency.ts's file-level
// cycle detection. Two files cycling within the same package is often
// fine (tightly coupled implementation details); two top-level packages
// (apps/web <-> packages/graph, say) cycling is a much bigger architectural
// smell — it means the workspace's own dependency boundaries, not just
// individual files, are tangled. Reuses the same DFS shape as
// detectCircularDependency.ts, applied to a package-id graph derived via
// the same "first two path segments" grouping calculateAffectedModules.ts
// uses.
//
// Type-only edges (TS `import type`, Python `if TYPE_CHECKING:`) are
// excluded from the package graph, matching detectCircularDependency.ts's
// runtime-cycle semantics (decision #458, Variant C): a package pair linked
// only by type imports has no runtime dependency between them.

import type { Repository } from "../repository/Repository";

export interface RepositoryPatternFinding {
  cycle: string[];
  message: string;
}

function packageIdOf(relativePath: string): string {
  const segments = relativePath.split("/");
  return segments.length >= 2 ? segments.slice(0, 2).join("/") : (segments[0] ?? relativePath);
}

export function detectRepositoryPattern(repository: Repository): RepositoryPatternFinding[] {
  const modules = repository.getAllModules();

  // Build package-level adjacency: which packages does each package import from
  const packageGraph = new Map<string, Set<string>>();
  for (const module of modules) {
    const fromPackage = packageIdOf(module.file.relativePath);
    // Type-only edges are compile-time deps, not runtime package
    // dependencies (decision #458-C, same as detectCircularDependency.ts).
    const typeOnlyTargets = new Set(
      (module.resolvedImports ?? [])
        .filter((r) => r.kind === "type-only")
        .map((r) => r.moduleId)
    );
    for (const importedId of module.imports) {
      if (typeOnlyTargets.has(importedId)) continue;
      const importedModule = repository.getModule(importedId);
      if (!importedModule) continue;
      const toPackage = packageIdOf(importedModule.file.relativePath);
      if (toPackage === fromPackage) continue; // intra-package edges aren't a cross-boundary concern here

      const set = packageGraph.get(fromPackage) ?? new Set();
      set.add(toPackage);
      packageGraph.set(fromPackage, set);
    }
  }

  const findings: RepositoryPatternFinding[] = [];
  const resolved = new Set<string>();
  const unresolved = new Set<string>();
  const stack: string[] = [];

  function resolve(pkg: string) {
    if (resolved.has(pkg)) return;

    unresolved.add(pkg);
    stack.push(pkg);

    for (const dep of packageGraph.get(pkg) ?? []) {
      if (resolved.has(dep)) continue;

      if (unresolved.has(dep)) {
        const cycleStart = stack.indexOf(dep);
        const cycle = [...stack.slice(cycleStart), dep];
        findings.push({
          cycle,
          message: `Package-level circular dependency: ${cycle.join(" -> ")}`,
        });
        continue;
      }

      resolve(dep);
    }

    resolved.add(pkg);
    unresolved.delete(pkg);
    stack.pop();
  }

  for (const pkg of packageGraph.keys()) {
    resolve(pkg);
  }

  return findings;
}
