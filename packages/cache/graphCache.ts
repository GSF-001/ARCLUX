// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Caches a built DependencyGraph (packages/graph/buildDependencyGraph.ts),
// keyed the same way as repositoryCache.ts: repoUrl + branch + a
// repo-level content fingerprint (see repositoryCache.ts's
// computeRepositoryFingerprint for how that's derived).
//
// DependencyGraph is derived entirely from a Repository
// (buildDependencyGraph(repository) -> DependencyGraph, see
// packages/engine/pipeline.ts), so it becomes stale under exactly the
// same condition a cached Repository would -- reusing the same
// fingerprint here means both caches invalidate together, rather than
// maintaining two separate (and potentially inconsistent) notions of
// "has this repo changed".
//
// In-memory only, same as fileCache.ts/repositoryCache.ts.

import type { DependencyGraph } from "../shared/types";

interface GraphCacheEntry {
  fingerprint: string;
  graph: DependencyGraph;
}

// Keyed by "repoUrl@branch", same convention as repositoryCache.ts.
const cache = new Map<string, GraphCacheEntry>();

function cacheKey(repoUrl: string, branch: string): string {
  return `${repoUrl}@${branch}`;
}

/**
 * Returns the cached DependencyGraph IF the given fingerprint matches
 * what it was cached with (use repositoryCache.ts's
 * computeRepositoryFingerprint to compute it -- both caches should be
 * fed the same fingerprint for a given repo state). Returns undefined
 * on a cache miss.
 */
export function getCachedGraph(repoUrl: string, branch: string, fingerprint: string): DependencyGraph | undefined {
  const entry = cache.get(cacheKey(repoUrl, branch));
  if (!entry) return undefined;
  if (entry.fingerprint !== fingerprint) return undefined;
  return entry.graph;
}

/** Stores a DependencyGraph in the cache, keyed by repoUrl + branch + fingerprint. */
export function setCachedGraph(repoUrl: string, branch: string, fingerprint: string, graph: DependencyGraph): void {
  cache.set(cacheKey(repoUrl, branch), { fingerprint, graph });
}

/** Removes a single repoUrl+branch entry from the cache. */
export function invalidateCachedGraph(repoUrl: string, branch: string): void {
  cache.delete(cacheKey(repoUrl, branch));
}

/** Clears the entire cache. See fileCache.ts's clearFileCache() for why this matters in a long-running process. */
export function clearGraphCache(): void {
  cache.clear();
}

/** Current number of cached entries. Useful for tests/debugging. */
export function graphCacheSize(): number {
  return cache.size;
}
