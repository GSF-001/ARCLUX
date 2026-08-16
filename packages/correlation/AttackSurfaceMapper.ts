// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Attack-surface mapping over ARCLUX's real DependencyGraph. Algorithm
// validated by experiment (2026-08-16, EXPERIMENTS_LOG.md exp "AttackSurfaceMapper"):
// BFS from entry points along import edges; sinks (high fan-in shared
// modules) measured by reachability + hop distance; disconnected cycles
// correctly excluded as unreachable.
//
// CRITICAL design finding from that experiment: detectEntryPoints() is
// convention-only (path regexes) and returns [] for generic repos (e.g.
// playground/express-demo). The entry set MUST therefore be the union of:
//   (a) convention entries   — detectEntryPoints()
//   (b) structural entries   — modules with zero importers (candidates for
//       app entry files like app.ts / index.ts that no convention matches)
//   (c) explicit config      — RemoteSource.extraEntryPaths

import type { Repository } from "../repository/Repository";
import type { DependencyGraph, GraphEdge } from "../shared/types";
import { detectEntryPoints } from "../detectors/detectEntryPoints";

export interface Exposure {
  targetModuleId: string;
  filePath: string;
  /** True when the module is reachable from at least one entry point. */
  reachable: boolean;
  /** Shortest hop distance from the nearest entry; null when unreachable. */
  distance: number | null;
  /** One shortest path (entry -> ... -> target); null when unreachable. */
  path: string[] | null;
}

export interface AttackSurfaceMap {
  repositoryId: string;
  /** Module ids of all entry points (convention + structural + explicit). */
  entryPoints: string[];
  /** Module ids reachable from entries via import edges. */
  reachableModules: string[];
  /** Module ids NOT reachable from any entry. */
  unreachableModules: string[];
  /** Per-module exposure detail for every module in the repository. */
  exposures: Exposure[];
  maxDepth: number;
}

export interface AttackSurfaceOptions {
  /** Additional explicit entry paths (module ids / relative paths). */
  extraEntryPaths?: string[];
  /** BFS depth cap (mirrors impact/buildImpactTree's maxDepth default). */
  maxDepth?: number;
  /** Restrict exposures to these module ids; default = all modules. */
  targets?: string[];
}

interface BfsState {
  reachable: Set<string>;
  distance: Map<string, number>;
  parent: Map<string, string | null>;
}

function bfs(adjacency: Map<string, string[]>, sources: string[], maxDepth: number): BfsState {
  const reachable = new Set<string>(sources);
  const distance = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const queue: Array<{ node: string; dist: number }> = [];

  for (const source of sources) {
    distance.set(source, 0);
    parent.set(source, null);
    queue.push({ node: source, dist: 0 });
  }

  while (queue.length > 0) {
    const { node, dist } = queue.shift()!;
    if (dist >= maxDepth) continue;
    for (const next of adjacency.get(node) ?? []) {
      if (reachable.has(next)) continue;
      reachable.add(next);
      distance.set(next, dist + 1);
      parent.set(next, node);
      queue.push({ node: next, dist: dist + 1 });
    }
  }

  return { reachable, distance, parent };
}

function reconstructPath(parent: Map<string, string | null>, target: string): string[] | null {
  if (!parent.has(target)) return null;
  const path: string[] = [];
  let cursor: string | null = target;
  while (cursor !== null) {
    path.unshift(cursor);
    cursor = parent.get(cursor) ?? null;
  }
  return path;
}

export function mapAttackSurface(repository: Repository, graph: DependencyGraph, options: AttackSurfaceOptions = {}): AttackSurfaceMap {
  const maxDepth = options.maxDepth ?? 20;
  const targets = options.targets ?? repository.getAllModules().map((m) => m.id);

  // (a) convention entries + (b) structural entries + (c) explicit config.
  const conventionEntries = detectEntryPoints(repository).map((f) => f.filePath);
  const structuralEntries = repository.findModulesWithNoImporters().map((m) => m.id);
  const explicitEntries = (options.extraEntryPaths ?? []).filter((p) => repository.getModule(p) !== undefined);

  const entryPoints = [...new Set([...conventionEntries, ...structuralEntries, ...explicitEntries])];

  // Adjacency over import edges only: source imports target (entry can reach what it imports).
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.type !== "import") continue;
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  const { reachable, distance, parent } = bfs(adjacency, entryPoints, maxDepth);

  const reachableModules = repository.getAllModules().filter((m) => reachable.has(m.id)).map((m) => m.id);
  const unreachableModules = repository.getAllModules().filter((m) => !reachable.has(m.id)).map((m) => m.id);

  const exposures: Exposure[] = targets.map((targetModuleId) => {
    const module = repository.getModule(targetModuleId);
    const isReachable = reachable.has(targetModuleId);
    return {
      targetModuleId,
      filePath: module?.file.relativePath ?? targetModuleId,
      reachable: isReachable,
      distance: isReachable ? (distance.get(targetModuleId) ?? 0) : null,
      path: isReachable ? reconstructPath(parent, targetModuleId) : null,
    };
  });

  return {
    repositoryId: graph.repositoryId,
    entryPoints,
    reachableModules,
    unreachableModules,
    exposures,
    maxDepth,
  };
}

export type { GraphEdge };
