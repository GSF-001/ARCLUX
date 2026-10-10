// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// replay.ts — P2-6 (08 §4 Sprint 3): harness re-simulasi determinisme CI.
//
// Prinsip Layer I.8 / D-008: dunia otoritatif adalah fungsional murni dari
// (snapshot_awal, log intent). Dua replika yang direplay dari log yang sama
// DARI snapshot yang sama wajib menghasilkan worldHash identik — kalau tidak,
// ada sumber nondeterminisme (Math.random, Date.now, iterasi Map tak-
// berurutan, dsb.) yang bocor ke sim.
//
// Dipakai test CI (tests/server-sprint3.test.ts) — jalankan 2 engine dari
// log yang sama, bandingkan worldHash.

import type { GameEvent, PlayerIntent, RegionSnapshot } from "./types";
import { regionFromState } from "./world";
import { SimulationEngine } from "./simulation";
import { worldHash } from "./stability";
import type { ValidatorContext } from "./validator";

export interface ResimulateOptions {
  authProvider: (playerId: string) => ValidatorContext;
  /** Step tambahan SETELAH event terakhir (default 0). */
  extraTicks?: number;
  /** Step sampe tick ini bila lebih besar dari tick event terakhir
   *  (pakai region.tick asli — coasting setelah intent terakhir ikut
   *  disimulasikan ulang). */
  untilTick?: number;
}

/**
 * Rebuild region dari `initial` + replay intent log per tick → worldHash.
 * Hanya intent (tipe mulai `intent_`) yang di-enqueue ulang; efek environs
 * deterministik (seeded) diulang oleh engine sendiri.
 *
 * CATATAN: `initial.entities` = live refs bila snapshot diambil langsung
 * dari region yang masih hidup — clone (structuredClone) SEBELUM engine
 * mutasi. Harness ini clone internal, tapi clone dari snapshot yang sudah
 * termutasi = state awal yang salah.
 */
export function resimulate(initial: RegionSnapshot, events: GameEvent[], opts: ResimulateOptions): string {
  // Deep-clone: regionFromState menaruh entity REF dari snapshot — replay
  // akan memutasi posisi/velocity. Snapshot awal wajib immutable (juga
  // melindungi caller yang memakai worldHash(region) setelah replay).
  const region = regionFromState(structuredClone(initial));
  const engine = new SimulationEngine({ region, authProvider: opts.authProvider });

  const byTick = new Map<number, PlayerIntent[]>();
  let maxTick = initial.tick;
  for (const ev of events) {
    if (ev.tick > maxTick) maxTick = ev.tick;
    if (!ev.type.startsWith("intent_")) continue;
    const p = ev.payload as { entityId?: string; type?: string; seq?: number; payload?: Record<string, unknown> };
    if (!p.entityId || !p.type) continue;
    const intent: PlayerIntent = {
      playerId: ev.actorId ?? "unknown",
      entityId: p.entityId,
      type: p.type,
      payload: p.payload ?? {},
      seq: p.seq ?? 0,
    };
    const list = byTick.get(ev.tick);
    if (list) list.push(intent);
    else byTick.set(ev.tick, [intent]);
  }

  // Langkah = (untilTick - initial.tick) — sama dengan jumlah step asli
  // (loop asli `for t in 0..N` = N+1 langkah; cursor pakai region.tick).
  const endTick = Math.max(maxTick + 1 + (opts.extraTicks ?? 0), opts.untilTick ?? 0);
  while (region.tick < endTick) {
    for (const intent of byTick.get(region.tick) ?? []) engine.enqueue(intent);
    engine.step();
  }
  return worldHash(region);
}
