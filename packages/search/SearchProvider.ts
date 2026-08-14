// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import { buildSearchIndex } from "./SearchIndex";
import type { SearchIndex } from "./SearchIndex";
import { search } from "./SearchEngine";
import { applyFilters } from "./SearchFilters";
import type { SearchFilters } from "./SearchFilters";
import type { SearchResult } from "./SearchResults";

/**
 * One in-memory "search session": caches the SearchIndex for the current
 * Repository so repeated query() calls skip rebuild work, and delegates
 * ranking to SearchEngine + narrowing to SearchFilters.
 *
 * BOUNDARY: despite the "Provider" name this is plain TypeScript — no
 * React, no context, no hooks. It is the data layer a React context
 * wrapper in apps/web would sit on top of (e.g. a SearchProvider.tsx that
 * calls createSearchSession() once and exposes query() via useContext).
 */
export interface SearchSession {
  /** The cached index for the current repository; null before setRepository(). */
  readonly index: SearchIndex | null;
  /** Swaps the analyzed repository and rebuilds the cached index (no-op for the same instance). */
  setRepository(repository: Repository): void;
  /** Runs a query against the cached index, then applies optional filters. */
  query(q: string, filters?: SearchFilters): SearchResult[];
}

export function createSearchSession(): SearchSession {
  let repository: Repository | null = null;
  let index: SearchIndex | null = null;

  return {
    get index(): SearchIndex | null {
      return index;
    },
    setRepository(repo: Repository): void {
      if (repo === repository) return; // same instance — keep the cached index
      repository = repo;
      index = buildSearchIndex(repo);
    },
    query(q: string, filters?: SearchFilters): SearchResult[] {
      if (!index) return [];
      return applyFilters(search(index, q), filters);
    },
  };
}
