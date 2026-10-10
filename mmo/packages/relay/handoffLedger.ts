// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// handoffLedger.ts — event record handoff lintas shard (Sprint 4 / P0-6).
//
// Setiap requestHandoff dicatat append-only: requested/delivered/rejected.
// lastSeq idempotency (cegah dobel-spawn dari seq berulang/stale) DIHITUNG dari
// ledger (event-sourced) → relay restart pun seq tetap konsisten, bukan Map
// in-memory yang reset dan melewati proteksi stale-seq.

import { appendRelayEvent, listRelayEvents } from "../db/repositories/RelayStore";
import type { RelayEventRecord } from "../db/schema";

export interface HandoffLedgerEvent {
  key: string;
  type: RelayEventRecord["type"];
  vesselId: string;
  fromShardId: string;
  toShardId: string;
  toRegionId: string;
  seq: number;
  ok: boolean;
  reason?: string;
}

export interface HandoffLedger {
  /** seq terakhir yang tercatat untuk key (idempotency stale-seq check). */
  lastSeq(key: string): number | undefined;
  append(ev: HandoffLedgerEvent): void;
  /** semua event (audit/debug). */
  list(): RelayEventRecord[];
}

/** In-memory ledger — untuk test & self-host 1 proses. */
export function createMemoryHandoffLedger(): HandoffLedger {
  const events: RelayEventRecord[] = [];
  let counter = 0;
  return {
    lastSeq(key) {
      // idempotency hanya naik saat DELIVERED sukses — requested/rejected
      // tidak mengunci seq (retry dengan seq sama tetap boleh setelah gagal).
      let max: number | undefined;
      for (const ev of events) {
        if (ev.key === key && ev.type === "delivered" && ev.ok && (max === undefined || ev.seq > max)) max = ev.seq;
      }
      return max;
    },
    append(ev) {
      events.push({ ...ev, id: `${Date.now()}-${++counter}`, at: new Date().toISOString() });
    },
    list: () => [...events],
  };
}

/** DB-backed ledger (Sprint 4) — persist ke packages/db, hydrate saat create. */
export function createDbHandoffLedger(): HandoffLedger {
  const mem = createMemoryHandoffLedger();
  // hydrate: event-sourced lastSeq.
  for (const ev of listRelayEvents()) mem.append(ev);
  return {
    lastSeq: (key) => mem.lastSeq(key),
    append(ev) {
      mem.append(ev);
      appendRelayEvent(ev);
    },
    list: () => mem.list(),
  };
}
