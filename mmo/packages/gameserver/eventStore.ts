// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// eventStore.ts — P2-2 (08 §4 Sprint 3): event log append-only + rotate.
//
// Memory ring (simulation.eventLog) dibatasi STABILITY_LIMITS.maxEventLog
// dan di-halve saat overflow — tapi production butuh log FULL untuk war
// review + replay (Layer I.8). EventStore menyimpan append-only JSONL per
// region dengan rotasi per file (max events/file + max age), supaya
// replayLog() bisa baca dari disk setelah restart, bukan dari memori
// yang sudah ke-reset.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { GameEvent } from "./types";

export interface EventStore {
  append(ev: GameEvent): void;
  /** Semua event (urut append), opsional filter dari tick tertentu. */
  replay(fromTick?: number): GameEvent[];
  /** Jumlah event tersimpan (approx untuk memory store). */
  size(): number;
  /** Tutup file aktif & mulai file baru (rotate). Tidak menghapus data
   *  lama — caller yang memutuskan retention policy. */
  rotate(): void;
}

/** In-memory store (tests + server kecil tanpa disk). */
export function createMemoryEventStore(maxEvents = 100_000): EventStore {
  const events: GameEvent[] = [];
  return {
    append(ev) {
      events.push(ev);
      if (events.length > maxEvents) events.splice(0, events.length - maxEvents);
    },
    replay(fromTick) {
      return fromTick === undefined ? [...events] : events.filter((e) => e.tick >= fromTick);
    },
    size() {
      return events.length;
    },
    rotate() {
      if (events.length > maxEvents / 2) events.splice(0, events.length - maxEvents / 2);
    },
  };
}

export interface JsonlEventStoreOptions {
  /** Direktori file JSONL (dibuat bila belum ada). */
  dir: string;
  regionId: string;
  /** Max event per file sebelum rotate (default 10.000 — 08 §4). */
  maxEventsPerFile?: number;
  /** Max umur file aktif sebelum rotate (default 24 jam). */
  maxAgeMs?: number;
  /** Max file tersimpan; file lebih lama dihapus (default 8 = ~80k event). */
  maxFiles?: number;
}

function safeFilePart(regionId: string): string {
  return regionId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Append-only JSONL: satu baris JSON per event. Rotate = tutup file aktif,
 * buka file sequence berikutnya; file lama dihapus melebihi maxFiles.
 * Sinkron (appendFileSync) — volume event region ~10/s, negligible.
 */
export function createJsonlEventStore(opts: JsonlEventStoreOptions): EventStore {
  const maxPerFile = opts.maxEventsPerFile ?? 10_000;
  const maxAgeMs = opts.maxAgeMs ?? 24 * 60 * 60 * 1000;
  const maxFiles = opts.maxFiles ?? 8;
  const prefix = safeFilePart(opts.regionId);
  const dir = opts.dir;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let fileSeq = 0;
  let activePath = "";
  let activeCount = 0;
  let activeOpenedAt = 0;
  /** Buffer tulis — flush per 64 event (atau rotate/stop) agar tick tidak
   *  menahan syscall sinkron per event. Crash ≤64 event terakhir hilang. */
  let queue: string[] = [];
  const FLUSH_EVERY = 64;

  const flush = (): void => {
    if (!queue.length || !activePath) return;
    appendFileSync(activePath, queue.join(""));
    activeCount += queue.length;
    queue = [];
  };

  const fileBase = (seq: number) => join(dir, `${prefix}-${String(seq).padStart(6, "0")}.jsonl`);

  const listFiles = (): string[] => {
    return readdirSync(dir)
      .filter((f) => f.startsWith(`${prefix}-`) && f.endsWith(".jsonl"))
      .sort()
      .map((f) => join(dir, f));
  };

  const trimOldFiles = (): void => {
    const files = listFiles();
    while (files.length > maxFiles) {
      const oldest = files.shift();
      if (!oldest || oldest === activePath) break;
      try {
        unlinkSync(oldest);
      } catch {
        /* best-effort */
      }
    }
  };

  const openNext = (): void => {
    const files = listFiles();
    for (const f of files) {
      const m = /-(\d{6})\.jsonl$/.exec(f);
      if (m) fileSeq = Math.max(fileSeq, parseInt(m[1], 10));
    }
    fileSeq += 1;
    activePath = fileBase(fileSeq);
    activeCount = 0;
    activeOpenedAt = Date.now();
    trimOldFiles();
  };

  return {
    append(ev) {
      if (!activePath || activeCount + queue.length >= maxPerFile || Date.now() - activeOpenedAt > maxAgeMs) {
        this.rotate();
      }
      queue.push(`${JSON.stringify(ev)}\n`);
      if (queue.length >= FLUSH_EVERY) flush();
    },
    replay(fromTick) {
      flush();
      const out: GameEvent[] = [];
      for (const f of listFiles()) {
        try {
          for (const line of readFileSync(f, "utf8").split("\n")) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as GameEvent;
            if (fromTick === undefined || ev.tick >= fromTick) out.push(ev);
          }
        } catch {
          /* file rusak/terpotong — skip baris invalid, lanjut file berikut */
        }
      }
      return out;
    },
    size() {
      flush();
      let total = 0;
      for (const f of listFiles()) {
        try {
          total += statSync(f).size; // bytes — indikator kasar
        } catch {
          /* ignore */
        }
      }
      return total;
    },
    rotate() {
      flush();
      // File lama dibiarkan (append-only) — retention via maxFiles.
      openNext();
    },
  };
}
