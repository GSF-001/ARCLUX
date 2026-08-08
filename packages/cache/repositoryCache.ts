// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Caches a full indexed Repository (packages/repository/Repository.ts),
// keyed by repoUrl + branch + a repo-level content fingerprint. See
// progres/decisions.md's cache research entries (2026-08-07/08) for why
// this is content-hash based rather than git-diff based.
//
// The fingerprint is a hash of every file's FileInfo.hash concatenated
// (in a stable, sorted order) -- if even one file's content changes,
// the fingerprint changes, and the cache entry is correctly treated as
// stale. This is cheaper to compute than hashing full file contents at
// lookup time, since FileInfo.hash is already computed once during
// scanFiles.ts and carried on each module.
//
// In-memory only, same as fileCache.ts -- see that file's header
// comment for why disk persistence isn't in scope yet.

import { hashObject } from "../shared/hash";
import type { Repository } from "../repository/Repository";
import type { FileInfo } from "../shared/types";

interface RepositoryCacheEntry {
  fingerprint: string;
  repository: Repository;
}

// Keyed by "repoUrl@branch" (branch defaults to whatever the caller
// resolved it to -- this module doesn't know or care about "default
// branch" semantics, that's cloneRepository.ts's job).
const cache = new Map<string, RepositoryCacheEntry>();

/**
 * Computes a repo-level fingerprint from a set of files' hashes.
 * Sorted by relativePath first so the same file set in a different
 * scan order still produces the same fingerprint -- order shouldn't
 * matter, only content.
 */
export function computeRepositoryFingerprint(files: Pick<FileInfo, "relativePath" | "hash">[]): string {
  const sorted = [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return hashObject(sorted.map((f) => `${f.relativePath}:${f.hash}`));
}

function cacheKey(repoUrl: string, branch: string): string {
  return `${repoUrl}@${branch}`;
}

/**
 * Returns the cached Repository IF the given fingerprint matches what
 * it was cached with. Returns undefined on a cache miss.
 */
export function getCachedRepository(repoUrl: string, branch: string, fingerprint: string): Repository | undefined {
  const entry = cache.get(cacheKey(repoUrl, branch));
  if (!entry) return undefined;
  if (entry.fingerprint !== fingerprint) return undefined;
  return entry.repository;
}

/** Stores a Repository in the cache, keyed by repoUrl + branch + fingerprint. */
export function setCachedRepository(
  repoUrl: string,
  branch: string,
  fingerprint: string,
  repository: Repository,
): void {
  cache.set(cacheKey(repoUrl, branch), { fingerprint, repository });
}

/** Removes a single repoUrl+branch entry from the cache. */
export function invalidateCachedRepository(repoUrl: string, branch: string): void {
  cache.delete(cacheKey(repoUrl, branch));
}

/** Clears the entire cache. See fileCache.ts's clearFileCache() for why this matters in a long-running process. */
export function clearRepositoryCache(): void {
  cache.clear();
}

/** Current number of cached entries. Useful for tests/debugging. */
export function repositoryCacheSize(): number {
  return cache.size;
}
