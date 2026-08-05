// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import type { DependencyGraph, GraphNode, GraphEdge, RawExport } from "../shared/types";

/**
 * Complement to buildDependencyGraph.ts: instead of "what does this module
 * import", this graph answers "who consumes what this module exports".
 *
 * One GraphNode per module that has at least one export (type: "file"),
 * carrying export metadata (names + a kind breakdown). One GraphEdge
 * (type: "export") per DISTINCT source->target module pair, mirroring the
 * dedup rule from buildDependencyGraph.ts — importedBy is a flat string[]
 * with no per-export granularity, so an edge here means "target consumes
 * at least one export from source", not "target consumes export X
 * specifically".
 *
 * Re-exports (RawExport.kind === "re-export", resolved via
 * ModuleInfo.resolvedReExports: exportName -> target moduleId) are folded
 * in as additional "export" edges from the ORIGINAL source module straight
 * to the re-exporting module, so a re-export chain (A re-exports from B)
 * shows up as an edge B -> A. Without this, a consumer of A would look
 * disconnected from B in the graph even though it transitively depends on
 * B's exports.
 *
 * A single global seenEdges set (keyed "source->target") dedupes across
 * BOTH the direct importedBy edges and the resolvedReExports edges, since
 * the same source->target pair can legitimately arise from either path
 * (e.g. B is both re-exported through A and separately imported directly
 * somewhere that resolves to the same pair) — a rendered edge represents
 * "does target depend on source's exports at all", so it should only ever
 * appear once regardless of which path produced it.
 *
 * NOTE: modules with zero importers still get a node (so unused-export
 * detectors have something to point the graph viewer at) but no outgoing
 * "export" edges — see Repository.findModulesWithNoImporters() for the
 * existing dead-export candidate list this complements.
 */
export function buildExportGraph(repository: Repository): DependencyGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const modules = repository.getAllModules();
  const moduleIds = new Set(modules.map((m) => m.id));
  const seenEdges = new Set<string>(); // "source->target", deduped across both edge sources below

  function addExportEdge(source: string, target: string): void {
    if (source === target) return; // no self-edges
    if (!moduleIds.has(source) || !moduleIds.has(target)) return; // internal edges only
    const key = `${source}->${target}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edges.push({ id: key, source, target, type: "export" });
  }

  for (const module of modules) {
    if (module.exports.length === 0) continue; // nothing to graph for this module

    const exportsByKind = module.exports.reduce<Record<RawExport["kind"], number>>(
      (acc, e) => {
        acc[e.kind] = (acc[e.kind] ?? 0) + 1;
        return acc;
      },
      { default: 0, named: 0, "re-export": 0 }
    );

    nodes.push({
      id: module.id,
      type: "file",
      label: module.file.relativePath.split("/").pop() ?? module.id,
      filePath: module.file.relativePath,
      metadata: {
        language: module.file.language,
        exportCount: module.exports.length,
        exportNames: module.exports.map((e) => e.name),
        exportsByKind,
      },
    });

    // Direct edges: this module -> each module that imports it.
    for (const importerId of module.importedBy) {
      addExportEdge(module.id, importerId);
    }

    // Re-export edges: fold resolvedReExports into extra "export" edges
    // from the ORIGINAL source straight to this re-exporting module.
    for (const targetModuleId of Object.values(module.resolvedReExports)) {
      addExportEdge(targetModuleId, module.id);
    }
  }

  return {
    repositoryId: repository.meta.id,
    nodes,
    edges,
    builtAt: new Date().toISOString(),
  };
}
