// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Real-mechanics tests for packages/cache/ (issue #455) — the fingerprint
// and cache-key logic consumed by analyzeRemoteRepository (repositoryCache/
// graphCache) and buildIndex (fileCache). MemoryCache is also pinned here;
// note it is currently DEAD CODE (zero importers repo-wide — verified by
// grep), kept tested so its contract survives until something consumes it.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { computeRepositoryFingerprint } from "../packages/cache/repositoryCache";
import {
  getCachedRepository,
  setCachedRepository,
  invalidateCachedRepository,
  clearRepositoryCache,
  repositoryCacheSize,
} from "../packages/cache/repositoryCache";
import {
  getCachedGraph,
  setCachedGraph,
  invalidateCachedGraph,
  clearGraphCache,
  graphCacheSize,
} from "../packages/cache/graphCache";
import {
  getCachedParsedFile,
  setCachedParsedFile,
  invalidateCachedParsedFile,
  clearFileCache,
  fileCacheSize,
} from "../packages/cache/fileCache";
import { getCacheStats, clearAllCaches } from "../packages/cache/CacheProvider";
import { MemoryCache } from "../packages/cache/memoryCache";
import type { RepositoryMeta } from "../packages/shared/types";

function makeRepository(id: string): Repository {
  const meta: RepositoryMeta = {
    id,
    org: "test-org",
    name: id,
    defaultBranch: "main",
    rootPath: "/virtual/repo",
    detectedFrameworks: [],
    packageManager: "npm",
    analyzedAt: new Date().toISOString(),
  };
  return new Repository(meta);
}

const EMPTY_GRAPH = { repositoryId: "g", nodes: [], edges: [], builtAt: new Date().toISOString() };

afterEach(() => {
  clearAllCaches();
});

describe("computeRepositoryFingerprint", () => {
  it("is order-independent for the same file set", () => {
    const a = [
      { relativePath: "b.ts", hash: "h2" },
      { relativePath: "a.ts", hash: "h1" },
    ];
    const b = [
      { relativePath: "a.ts", hash: "h1" },
      { relativePath: "b.ts", hash: "h2" },
    ];
    expect(computeRepositoryFingerprint(a)).toBe(computeRepositoryFingerprint(b));
  });

  it("changes when any file's content hash changes", () => {
    const base = [{ relativePath: "a.ts", hash: "h1" }];
    const changed = [{ relativePath: "a.ts", hash: "h2" }];
    expect(computeRepositoryFingerprint(base)).not.toBe(computeRepositoryFingerprint(changed));
  });
});

describe("repositoryCache", () => {
  it("returns the cached Repository only when the fingerprint matches", () => {
    setCachedRepository("https://github.com/x/repo", "main", "fp1", makeRepository("r1"));
    expect(getCachedRepository("https://github.com/x/repo", "main", "fp1")).not.toBeUndefined();
    // Same key, different fingerprint (repo content changed) -> miss.
    expect(getCachedRepository("https://github.com/x/repo", "main", "fp2")).toBeUndefined();
    // Different key entirely -> miss.
    expect(getCachedRepository("https://github.com/x/repo", "dev", "fp1")).toBeUndefined();
  });

  it("invalidates a single entry and clears the whole cache", () => {
    setCachedRepository("r", "main", "fp", makeRepository("r1"));
    setCachedRepository("r", "dev", "fp", makeRepository("r2"));
    expect(repositoryCacheSize()).toBe(2);
    invalidateCachedRepository("r", "main");
    expect(getCachedRepository("r", "main", "fp")).toBeUndefined();
    expect(repositoryCacheSize()).toBe(1);
    clearRepositoryCache();
    expect(repositoryCacheSize()).toBe(0);
  });
});

describe("graphCache", () => {
  it("returns the cached graph only when the fingerprint matches", () => {
    setCachedGraph("g", "main", "fp", EMPTY_GRAPH);
    expect(getCachedGraph("g", "main", "fp")).toBe(EMPTY_GRAPH);
    expect(getCachedGraph("g", "main", "other")).toBeUndefined();
  });

  it("invalidates and clears", () => {
    setCachedGraph("g", "main", "fp", EMPTY_GRAPH);
    invalidateCachedGraph("g", "main");
    expect(graphCacheSize()).toBe(0);
    setCachedGraph("g", "main", "fp", EMPTY_GRAPH);
    clearGraphCache();
    expect(graphCacheSize()).toBe(0);
  });
});

describe("fileCache", () => {
  const parsed = { file: {} as never, imports: [], exports: [], warnings: [] };

  it("hits on identical content, misses when the file content changed", () => {
    setCachedParsedFile("src/a.ts", "const x = 1;", parsed);
    expect(getCachedParsedFile("src/a.ts", "const x = 1;")).toBe(parsed);
    // Same path, different content -> the cached parse is stale.
    expect(getCachedParsedFile("src/a.ts", "const x = 2;")).toBeUndefined();
  });

  it("invalidates a single path and clears", () => {
    setCachedParsedFile("src/a.ts", "1", parsed);
    setCachedParsedFile("src/b.ts", "1", parsed);
    expect(fileCacheSize()).toBe(2);
    invalidateCachedParsedFile("src/a.ts");
    expect(getCachedParsedFile("src/a.ts", "1")).toBeUndefined();
    expect(fileCacheSize()).toBe(1);
    clearFileCache();
    expect(fileCacheSize()).toBe(0);
  });
});

describe("CacheProvider", () => {
  it("aggregates sizes across the three caches", () => {
    setCachedParsedFile("a.ts", "1", { file: {} as never, imports: [], exports: [], warnings: [] });
    setCachedRepository("r", "main", "fp", makeRepository("r1"));
    setCachedGraph("g", "main", "fp", EMPTY_GRAPH);
    const stats = getCacheStats();
    expect(stats.fileCacheSize).toBe(1);
    expect(stats.repositoryCacheSize).toBe(1);
    expect(stats.graphCacheSize).toBe(1);
    expect(stats.totalEntries).toBe(3);
    clearAllCaches();
    expect(getCacheStats().totalEntries).toBe(0);
  });
});

describe("MemoryCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and returns values without a TTL", () => {
    const cache = new MemoryCache<string, number>();
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.has("a")).toBe(true);
    expect(cache.size).toBe(1);
  });

  it("expires entries after their TTL elapses", () => {
    const cache = new MemoryCache<string, number>();
    cache.set("a", 1, 1000);
    vi.advanceTimersByTime(999);
    expect(cache.get("a")).toBe(1);
    vi.advanceTimersByTime(2);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.has("a")).toBe(false);
  });

  it("deletes and clears entries", () => {
    const cache = new MemoryCache<string, number>();
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.delete("a")).toBe(true);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
