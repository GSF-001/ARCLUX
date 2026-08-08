// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import type { DependencyGraph, GraphNode, GraphEdge } from "../shared/types";

/**
 * Turns an indexed Repository into a renderable DependencyGraph.
 * One GraphNode per module (type: "file") plus one GraphNode per distinct
 * external package actually imported. One GraphEdge per DISTINCT import
 * relationship (deduped by source->target pair).
 *
 * This is intentionally dumb/structural — semantic node types (route, component,
 * hook) get added later by indexer/resolveRoutes.ts, resolveComponents.ts etc,
 * which should mutate metadata on top of this base graph, not replace it.
 *
 * Bug fix: a module's `imports` array can contain the same target moduleId
 * more than once — e.g. `import { X } from "./Y"` and
 * `import type { Z } from "./Y"` in the same file both resolve to "./Y",
 * so buildIndex.ts's resolvedImportIds legitimately has two entries with
 * the same value (each carries different kind/identifier info consumers
 * like detectUnusedExports.ts need — deduping THERE would lose data).
 * Deduping belongs here instead, since a rendered graph edge represents
 * "does A depend on B at all", not "how many import statements said so".
 * Without this, GraphCanvas.tsx renders two <GraphEdge> with an identical
 * React key (`${source}->${target}`), which is what the "Encountered two
 * children with the same key" warning traces back to.
 */
export function buildDependencyGraph(repository: Repository): DependencyGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const modules = repository.getAllModules();
  const moduleIds = new Set(modules.map((m) => m.id));

  for (const module of modules) {
    nodes.push({
      id: module.id,
      type: "file",
      label: module.file.relativePath.split("/").pop() ?? module.id,
      filePath: module.file.relativePath,
      metadata: {
        language: module.file.language,
        exportCount: module.exports.length,
      },
    });

    const seenTargets = new Set<string>();
    for (const importedId of module.imports) {
      if (!moduleIds.has(importedId)) continue; // internal edges only
      if (seenTargets.has(importedId)) continue; // dedup — see comment above
      seenTargets.add(importedId);

      edges.push({
        id: `${module.id}->${importedId}`,
        source: module.id,
        target: importedId,
        type: "import",
      });
    }

    // Same-package/same-scope implicit dependencies (Go, Java -- see
    // parseGo.ts/parseJava.ts's scopeId, resolveSameScopeDependencies.ts).
    // These never appear in module.imports since there's no import
    // statement for them at all, so they need their own pass here or
    // the graph renders these files as disconnected islands even
    // though they genuinely depend on each other. Fixes the bug where
    // e.g. a Java repo like spring-boot shows all its file nodes with
    // zero edges between them.
    for (const implicitId of module.implicitDependencies) {
      if (!moduleIds.has(implicitId)) continue;
      if (seenTargets.has(implicitId)) continue; // already covered by an explicit import
      seenTargets.add(implicitId);

      edges.push({
        id: `${module.id}->${implicitId}`,
        source: module.id,
        target: implicitId,
        type: "import",
      });
    }
  }

  // Note: external package nodes are added by resolveExports.ts / a future pass,
  // since buildIndex.ts currently drops unresolved imports rather than tagging
  // them with a package name. Left as a TODO hook — see resolveAliases.ts.

  return {
    repositoryId: repository.meta.id,
    nodes,
    edges,
    builtAt: new Date().toISOString(),
  };
}
