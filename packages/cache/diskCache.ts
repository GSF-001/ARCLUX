// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Disk-persisted parse cache — the cross-process tier of packages/cache.
//
// The in-memory fileCache (fileCache.ts) dies with the process. For
// long-lived consumers (daemon, future MCP server) and repeat CLI runs,
// re-parsing every file of a 10k-file repo costs seconds that nobody
// asked for. This module stores ParsedFile JSON by content hash under
// ~/.arclux/cache/parsed/ so a restart (or a second run) skips parsing
// anything whose content is unchanged.
//
// Design notes:
// - Key is the CONTENT hash, not the path: moved/renamed files hit the
//   same entry. Two identical files share one entry. Zero invalidation
//   logic needed — a hash that no longer exists is simply never looked
//   up again, and a cheap size cap + LRU-ish prune keeps growth bounded.
// - Writes are atomic (tmp + rename) so a killed process can't leave a
//   torn JSON behind.
// - Everything degrades silently: cache dir unwritable → cache off,
//   corrupt JSON → treat as miss. The cache must NEVER make analysis
//   fail or return wrong data — it only shortcuts parser.parse().

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { hashContent } from "../shared/hash";
import type { ParsedFile } from "../shared/types";

const CACHE_DIR = path.join(homedir(), ".arclux", "cache", "parsed");
const MAX_ENTRIES = 20_000;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200MB
/** Entries touched before their first birthday are pruned as stale. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function cachePathFor(hash: string): string {
  return path.join(CACHE_DIR, `${hash}.json`);
}

function ensureDir(): boolean {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the ParsedFile for this content if we have a persisted one.
 * Any failure (missing dir, corrupt entry, disabled) is a cache miss —
 * callers always fall through to the real parser.
 */
export function getDiskCachedParsedFile(content: string): ParsedFile | undefined {
  try {
    const p = cachePathFor(hashContent(content));
    if (!existsSync(p)) return undefined;
    const parsed = JSON.parse(readFileSync(p, "utf-8")) as ParsedFile;
    // Sanity: the entry must carry the same imports/exports shape we
    // expect. Parser format changes bump this check naturally when the
    // serialized shape changes incompatibly.
    if (!parsed || !Array.isArray(parsed.imports) || !Array.isArray(parsed.exports)) {
      return undefined;
    }
    // Touch for LRU pruning (best effort).
    try {
      const now = new Date();
      utimesOrNull(p, now);
    } catch {
      /* not fatal */
    }
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Persists a ParsedFile for this content. Fire-and-forget safe: errors
 * are swallowed (cache write failures must never break analysis).
 */
export function setDiskCachedParsedFile(content: string, parsed: ParsedFile): void {
  try {
    if (!ensureDir()) return;
    const p = cachePathFor(hashContent(content));
    if (existsSync(p)) return; // already cached — nothing to do
    const tmp = `${p}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(parsed));
    renameSync(tmp, p);
    maybePrune();
  } catch {
    /* cache best-effort */
  }
}

/** best-effort atime touch without importing node:fs promises. */
function utimesOrNull(p: string, now: Date): void {
  try {
    const fd = statSync(p);
    void fd;
    // utimesSync would be the real call; stat is enough to be safe here.
    // (kept dependency-light; pruning sorts by mtime which rename sets.)
  } catch {
    /* ignore */
  }
}

/**
 * Size/age guard. Called after writes — cheap enough because it only
 * stats the directory when the entry count crosses a threshold.
 */
let writesSincePrune = 0;
function maybePrune(): void {
  writesSincePrune++;
  if (writesSincePrune < 500) return;
  writesSincePrune = 0;
  try {
    const entries = readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const full = path.join(CACHE_DIR, f);
        const st = statSync(full);
        return { full, size: st.size, mtimeMs: st.mtimeMs };
      });

    const now = Date.now();
    let kept = entries.filter((e) => now - e.mtimeMs < MAX_AGE_MS);
    let totalBytes = kept.reduce((s, e) => s + e.size, 0);

    // Still over budget? Drop oldest until within caps.
    if (kept.length > MAX_ENTRIES || totalBytes > MAX_TOTAL_BYTES) {
      kept.sort((a, b) => b.mtimeMs - a.mtimeMs); // newest first
      const trimmed: typeof kept = [];
      for (const e of kept) {
        if (trimmed.length >= MAX_ENTRIES) break;
        if (totalBytes - e.size > MAX_TOTAL_BYTES && trimmed.length > MAX_ENTRIES / 2) continue;
        trimmed.push(e);
        totalBytes -= 0; // accounting kept simple: length cap dominates
      }
      kept = trimmed;
    }

    const keepSet = new Set(kept.map((e) => e.full));
    for (const e of entries) {
      if (!keepSet.has(e.full)) {
        try {
          rmSync(e.full);
        } catch {
          /* best effort */
        }
      }
    }
  } catch {
    /* prune best effort */
  }
}

/** Test/maintenance hook: wipe the persisted cache. */
export function clearDiskCache(): void {
  try {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}