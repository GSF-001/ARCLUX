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
 * external package actually imported. One GraphEdge per import relationship.
 *
 * This is intentionally dumb/structural — semantic node types (route, component,
 * hook) get added later by indexer/resolveRoutes.ts, resolveComponents.ts etc,
 * which should mutate metadata on top of this base graph, not replace it.
 */
export function buildDependencyGraph(repository: Repository): DependencyGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenExternalPackages = new Set<string>();

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

    for (const importedId of module.imports) {
      // Internal edges only — imports pointing to a module id we actually indexed
      if (moduleIds.has(importedId)) {
        edges.push({
          id: `${module.id}->${importedId}`,
          source: module.id,
          target: importedId,
          type: "import",
        });
      }
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
