// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { fuzzyScore } from "./fuzzyScore";
import type { SearchEntry, SearchIndex } from "./SearchIndex";
import type { SearchResult } from "./SearchResults";

/** Options for search(). */
export interface SearchOptions {
  /** Hard cap on returned results (default 50). */
  limit?: number;
  /** Drop results scoring below this value (applied after ranking, before the cap). */
  minScore?: number;
}

const DEFAULT_LIMIT = 50;

/** Fields whose text contains the query as a substring, used to populate `matches`. */
function computeMatches(entry: SearchEntry, query: string): string[] {
  const needle = query.toLowerCase();
  const matches: string[] = [];
  if (entry.filePath.toLowerCase().includes(needle)) matches.push("filePath");
  if (entry.fileName.toLowerCase().includes(needle)) matches.push("fileName");
  for (const name of entry.exports) {
    if (name.toLowerCase().includes(needle)) matches.push(name);
  }
  return matches;
}

function compareResults(a: SearchResult, b: SearchResult): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.filePath.length !== b.filePath.length) return a.filePath.length - b.filePath.length;
  return a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0;
}

/**
 * Ranks every entry in `index` against `query` with fuzzyScore and returns
 * the best hits. The scoring text is the full file path, with the file name
 * and export names passed as aliases, so a module matches on any of the
 * three (e.g. a query equal to an export name finds the module exporting it).
 * Results are sorted by score descending (ties: shorter path first, then
 * lexicographic) and capped at `options.limit`.
 *
 * BOUNDARY: plain TypeScript — no React, no JSX. Pure function: same index
 * + query => same results, safe to call from API routes, the CLI, or a
 * future web UI layer.
 */
export function search(index: SearchIndex, query: string, options: SearchOptions = {}): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed || index.entries.length === 0) return [];

  const limit = options.limit ?? DEFAULT_LIMIT;
  const minScore = options.minScore ?? 0;

  const results: SearchResult[] = [];
  for (const entry of index.entries) {
    const score = fuzzyScore(entry.filePath, trimmed, [entry.fileName, ...entry.exports]);
    if (score <= 0) continue;

    const fieldMatches = computeMatches(entry, trimmed);
    results.push({
      moduleId: entry.moduleId,
      filePath: entry.filePath,
      score,
      language: entry.language,
      matches: fieldMatches.length > 0 ? fieldMatches : undefined,
    });
  }

  results.sort(compareResults);

  const aboveFloor = minScore > 0 ? results.filter((r) => r.score >= minScore) : results;
  return aboveFloor.slice(0, limit);
}
