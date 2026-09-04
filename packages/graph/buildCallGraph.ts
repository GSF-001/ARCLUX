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
 * Call-graph variant of buildImportGraph.ts. Where the import graph answers
 * "does A depend on B at the module level", this answers "which module's
 * functions does A actually CALL". Edges are `type: "call"` with weight =
 * number of DISTINCT call sites (callee+line pairs, deduped) from source to
 * target — the call-site granularity mirrors the data model: ResolvedCall
 * carries no column, so two calls to the same callee on one line are one
 * call site.
 *
 * The raw material is ModuleInfo.calls (ResolvedCall[]), populated by
 * buildIndex.ts pass 3 via the two-pass resolver (packages/graph/
 * resolveCalls.ts — import-verified, unique-global, explicit-unresolved;
 * never silent-picks, never silent-drops). Two known limitations inherited
 * from extraction (see extractJs.ts's extractCallsJs doc comment):
 *   1. Calls of default-imported functions resolve via
 *      RawImport.defaultLocalName, verified against the target's default
 *      export — the old total blind spot is closed.
 *   2. `obj.foo()` / `this.foo()` are never captured at all — the parser
 *      layer is AST-only (no type checker), and those callees are property
 *      accesses, not identifiers.
 *
 * Node shape mirrors buildImportGraph.ts exactly — same modules, same
 * "file" type — only the edges differ.
 */
export function buildCallGraph(repository: Repository): DependencyGraph {
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

    const seenCallSites = new Set<string>();
    const weightByTarget = new Map<string, number>();
    for (const call of module.calls) {
      if (!moduleIds.has(call.moduleId)) continue; // internal edges only
      const key = `${call.calleeName}:${call.line}`;
      if (seenCallSites.has(key)) continue; // dedup — see comment above
      seenCallSites.add(key);
      const current = weightByTarget.get(call.moduleId) ?? 0;
      weightByTarget.set(call.moduleId, current + 1);
    }

    for (const [targetId, weight] of weightByTarget) {
      edges.push({
        id: `${module.id}->${targetId}`,
        source: module.id,
        target: targetId,
        type: "call",
        weight,
      });
    }
  }

  return {
    repositoryId: repository.meta.id,
    nodes,
    edges,
    builtAt: new Date().toISOString(),
  };
}
