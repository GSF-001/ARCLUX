// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SupportedLanguage } from "../shared/types";

/**
 * One ranked search hit. The engine always sets moduleId/filePath/score/
 * language; `matches` is a best-effort attribution and may be undefined
 * when the query only matched through fuzzy scoring (e.g. transposition
 * or character jumps) rather than a plain substring.
 *
 * BOUNDARY: this module is plain TypeScript — no React, no JSX. It only
 * defines the result data shape and pure transforms so packages/ stays
 * framework-agnostic; rendering lives in apps/web.
 */
export interface SearchResult {
  moduleId: string;
  /** POSIX-style path relative to the repository root */
  filePath: string;
  /** 0..1, from packages/search/fuzzyScore.ts */
  score: number;
  language: SupportedLanguage;
  /** Fields whose text contains the query as a substring: "filePath", "fileName", or export names */
  matches?: string[];
}

/**
 * Groups results by the directory containing each file ("" for the
 * repository root). Preserves the input order within each group and the
 * first-seen order of groups.
 */
export function groupByFolder(results: SearchResult[]): Record<string, SearchResult[]> {
  const groups: Record<string, SearchResult[]> = {};
  for (const result of results) {
    const separator = result.filePath.lastIndexOf("/");
    const folder = separator === -1 ? "" : result.filePath.slice(0, separator);
    (groups[folder] ??= []).push(result);
  }
  return groups;
}

/** Inverse of groupByFolder: concatenates groups back into a flat list in group order. */
export function flatten(groups: Record<string, SearchResult[]>): SearchResult[] {
  return Object.values(groups).flat();
}
