// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SupportedLanguage } from "../shared/types";
import type { SearchResult } from "./SearchResults";

/** Narrowing criteria applied to already-ranked search results. */
export interface SearchFilters {
  /** Keep only results from modules written in this language. */
  language?: SupportedLanguage;
  /**
   * Keep only results whose file lives at or under this directory (POSIX
   * relative path). "src/components" matches "src/components/Button.tsx"
   * but not "src/componentsx/Other.tsx". Empty string matches everything.
   */
  folderPrefix?: string;
  /** Keep only results with score >= this value. */
  minScore?: number;
}

function normalizePrefix(prefix: string | undefined): string {
  return (prefix ?? "").replace(/^\/+|\/+$/g, "");
}

/**
 * Pure filter over a ranked result list. Intended to run AFTER
 * SearchEngine.search so ranking order is preserved — narrowing never
 * re-ranks, it only removes results.
 *
 * BOUNDARY: plain TypeScript — no React, no JSX.
 */
export function applyFilters(results: SearchResult[], filters?: SearchFilters): SearchResult[] {
  if (!filters) return results;
  const folder = normalizePrefix(filters.folderPrefix);

  return results.filter((result) => {
    if (filters.language !== undefined && result.language !== filters.language) return false;
    if (filters.minScore !== undefined && result.score < filters.minScore) return false;
    if (folder) {
      const path = result.filePath.replace(/^\/+/, "");
      if (path !== folder && !path.startsWith(`${folder}/`)) return false;
    }
    return true;
  });
}
