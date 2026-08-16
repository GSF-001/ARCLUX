// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceProvider } from "./types";

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
