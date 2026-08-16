// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Content channel for content-based detectors (secrets, unsafe patterns).
 *
 * ARCLUX's Repository deliberately does NOT carry file contents (verified
 * in buildIndex.ts: content is read, used for resolveSameScopeDependencies,
 * then discarded). Detectors that need the raw text take a SourceProvider
 * as an explicit extension input — the file LIST still comes from the
 * Repository, so detectors never re-scan the filesystem themselves.
 */
export interface SourceProvider {
  /** Returns the file content, or null when the path is unknown/unreadable. */
  read(relativePath: string): string | null;
}

/**
 * Default SourceProvider backed by the filesystem. Reads relative paths
 * against the repository root (the same rootPath buildIndex used), with
 * an in-memory cache so a detector run reads each file at most once.
 *
 * Per-run instance: create a new DiskSourceProvider per analysis so two
 * concurrent runs never share a cache. Cheap (readFileSync is fast; the
 * cache only matters for the regex-heavy content detectors).
 */
export class DiskSourceProvider implements SourceProvider {
  private cache = new Map<string, string | null>();

  constructor(private rootPath: string) {}

  read(relativePath: string): string | null {
    const cached = this.cache.get(relativePath);
    if (cached !== undefined) return cached;

    let content: string | null = null;
    try {
      content = readFileSync(join(this.rootPath, relativePath), "utf-8");
    } catch {
      content = null; // unknown/unreadable path -> null, never throws
    }
    this.cache.set(relativePath, content);
    return content;
  }
}
