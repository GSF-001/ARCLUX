// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import type { SupportedLanguage } from "../shared/types";

/**
 * One searchable module: the fields SearchEngine scores with fuzzyScore
 * (file path as the primary text, file name + export names as aliases).
 */
export interface SearchEntry {
  moduleId: string;
  /** POSIX-style path relative to the repository root (FileInfo.relativePath) */
  filePath: string;
  /** Last path segment, e.g. "pipeline.ts" for "src/engine/pipeline.ts" */
  fileName: string;
  language: SupportedLanguage;
  /** Unique export names in source order (deduplicated) */
  exports: string[];
}

/**
 * The searchable snapshot of a Repository. Pure data: building it does not
 * mutate the Repository and the index holds no reference back to it.
 */
export interface SearchIndex {
  repositoryId: string;
  entryCount: number;
  entries: SearchEntry[];
}

/**
 * Builds a SearchIndex from a Repository's modules. Pure data structure —
 * no I/O, no React, no shared state. Build once per analysis, reuse for
 * many queries (see SearchProvider.createSearchSession, which caches the
 * index per repository).
 */
export function buildSearchIndex(repository: Repository): SearchIndex {
  const entries: SearchEntry[] = [];
  for (const module of repository.getAllModules()) {
    const filePath = module.file.relativePath;
    const fileName = filePath.split("/").pop() ?? filePath;

    const exports: string[] = [];
    const seen = new Set<string>();
    for (const exp of module.exports) {
      if (!seen.has(exp.name)) {
        seen.add(exp.name);
        exports.push(exp.name);
      }
    }

    entries.push({
      moduleId: module.id,
      filePath,
      fileName,
      language: module.file.language,
      exports,
    });
  }

  return {
    repositoryId: repository.meta.id,
    entryCount: entries.length,
    entries,
  };
}
