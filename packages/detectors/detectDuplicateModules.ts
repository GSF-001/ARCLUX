// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Original ARCLUX logic, not adapted from any external source.

import type { Repository } from "../repository/Repository";

export interface DuplicateModuleGroup {
  hash: string;
  filePaths: string[];
  sizeBytes: number;
}

// Was 200 — turned out too low. Verified against this repo's real stub
// files (`doctor .` run, 2026-08): every empty stub file with just the
// Apache 2.0 header + a one-line trailing comment is 263 bytes, not under
// 200. 149 stub files hashed identically and got grouped as one giant
// false-positive "duplicate" — confirming the failure mode this filter
// was meant to prevent, just at the wrong threshold. Raised to 300, comfortably
// above the measured 263B stub size.
//
// This is still a brittle heuristic, not a fix: FileInfo has no lineCount
// or content field (only sizeBytes/hash — see packages/shared/types.ts),
// so byte size is the only cheap signal available without reading files
// off disk. If the license header text changes (more/fewer lines, longer
// URL, etc.) stub byte size shifts and this threshold can go stale again
// in either direction. A sturdier fix would be hashing only files above
// a size AND excluding a known "empty stub" hash set computed once from
// an actual empty-file template — not attempted here to keep this pass
// scoped to the immediate false positive.
const DEFAULT_MIN_SIZE_BYTES = 300;

/**
 * Groups files by content hash (FileInfo.hash) to find byte-for-byte
 * duplicates.
 *
 * Has a minimum size filter for a concrete reason found while writing this
 * ON THIS VERY REPOSITORY: every file in packages/ and apps/ carries an
 * identical Apache 2.0 license header (see PROGRES.md — "header lisensi
 * ganda" incident). Files that are STILL EMPTY except for that header
 * would all hash identically if this didn't filter them out, producing a
 * massive false-positive "duplicate" group that's really just "every stub
 * file has the same license comment." The threshold is a blunt instrument
 * (a genuinely short real file could still be skipped) but it directly
 * addresses a false positive this repo would hit on its very first run.
 */
export function detectDuplicateModules(
  repository: Repository,
  minSizeBytes: number = DEFAULT_MIN_SIZE_BYTES
): DuplicateModuleGroup[] {
  const byHash = new Map<string, { filePaths: string[]; sizeBytes: number }>();

  for (const module of repository.getAllModules()) {
    if (module.file.sizeBytes < minSizeBytes) continue;

    const entry = byHash.get(module.file.hash);
    if (entry) {
      entry.filePaths.push(module.file.relativePath);
    } else {
      byHash.set(module.file.hash, {
        filePaths: [module.file.relativePath],
        sizeBytes: module.file.sizeBytes,
      });
    }
  }

  return Array.from(byHash.entries())
    .filter(([, entry]) => entry.filePaths.length > 1)
    .map(([hash, entry]) => ({ hash, filePaths: entry.filePaths, sizeBytes: entry.sizeBytes }))
    .sort((a, b) => b.filePaths.length - a.filePaths.length);
}
