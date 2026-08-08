// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Content-hash based cache for parser output (ParsedFile). Design notes
// (see progres/decisions.md, cache research entries from 2026-08-07/08):
//
// This is a content-hash strategy (like dependency-cruiser's
// ContentStrategy), not a git-diff strategy (like their
// MetadataStrategy). A git-diff approach was considered first but
// doesn't fit ARCLUX's current flow: cloneRepository.ts defaults to a
// shallow clone (depth=1), so there's no prior commit to diff against
// on a fresh analyzeRepository() call. Content hashing works
// regardless of clone depth, since it only looks at file content, not
// git history.
//
// This module is in-memory only for now (no disk persistence) --
// helps when the same file is parsed more than once within a single
// process lifetime (e.g. repeated analysis during local development,
// or if a future watcher re-triggers analysis on unrelated file
// changes). It intentionally does NOT persist across process restarts;
// packages/db handles durable persistence, a different concern.

import { hashContent } from "../shared/hash";
import type { ParsedFile } from "../shared/types";

interface FileCacheEntry {
  contentHash: string;
  parsed: ParsedFile;
}

// Keyed by file path. Each entry also stores the content hash it was
// computed from, so a stale entry (path present, but content changed)
// is detected on lookup rather than trusting the path alone.
const cache = new Map<string, FileCacheEntry>();

/**
 * Returns the cached ParsedFile for this path IF the given content
 * hashes to the same value as when it was cached. Returns undefined on
 * a cache miss (never cached, or content changed since).
 */
export function getCachedParsedFile(filePath: string, content: string): ParsedFile | undefined {
  const entry = cache.get(filePath);
  if (!entry) return undefined;

  const currentHash = hashContent(content);
  if (entry.contentHash !== currentHash) return undefined;

  return entry.parsed;
}

/**
 * Stores a ParsedFile in the cache, keyed by path + a hash of the
 * content it was parsed from. Call this after a successful parse, not
 * before -- there's no reason to cache before wr know parsing succeeded.
 */
export function setCachedParsedFile(filePath: string, content: string, parsed: ParsedFile): void {
  cache.set(filePath, {
    contentHash: hashContent(content),
    parsed,
  });
}

/** Removes a single path from the cache. Useful once a real file-watcher exists. */
export function invalidateCachedParsedFile(filePath: string): void {
  cache.delete(filePath);
}

/**
 * Clears the entire cache. See helpers.mjs's comment in the
 * dependency-cruiser reference about the same concern: a long-running
 * process (e.g. a future persistent watcher) should call this
 * periodically or between unrelated repos, so memory doesn't grow
 * unbounded across many different analyzed repositories.
 */
export function clearFileCache(): void {
  cache.clear();
}

/** Current number of cached entries. Useful for tests/debugging, not meant for production logic. */
export function fileCacheSize(): number {
  return cache.size;
}
