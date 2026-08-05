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
 * Weighted variant of buildDependencyGraph.ts. That function answers
 * "does A depend on B" (one deduped edge per pair, no weight).  This one
 * answers "how HEAVILY does A depend on B" by using ModuleInfo.resolvedImports
 * (identifier-level detail — one entry per import statement) instead of the
 * flattened `imports: string[]`, and setting GraphEdge.weight to the number
 * of distinct import statements from A that resolve to B.
 *
 * IMPORTANT: GraphEdge has no metadata field, only `weight?: number` — so
 * the kind breakdown (static/dynamic/require/type-only) and named-import
 * lists on ResolvedImport are intentionally NOT preserved here. A consumer
 * that needs that level of detail (e.g. a detector or a tooltip) should
 * read repository.getModule(id).resolvedImports directly rather than rely
 * on this graph; folding that detail into `weight` would collapse
 * meaningfully different information into one number.
 *
 * Node shape mirrors buildDependencyGraph.ts exactly — same modules, same
 * "file" type — only the edges differ.
 */
export function buildImportGraph(repository: Repository): DependencyGraph {
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

    // Group resolvedImports by target moduleId so multiple import
    // statements to the same file collapse into one weighted edge instead
    // of one edge per statement.
    const weightByTarget = new Map<string, number>();
    for (const resolvedImport of module.resolvedImports) {
      if (!moduleIds.has(resolvedImport.moduleId)) continue; // internal edges only
      const current = weightByTarget.get(resolvedImport.moduleId) ?? 0;
      weightByTarget.set(resolvedImport.moduleId, current + 1);
    }

    for (const [targetId, weight] of weightByTarget) {
      edges.push({
        id: `${module.id}->${targetId}`,
        source: module.id,
        target: targetId,
        type: "import",
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
