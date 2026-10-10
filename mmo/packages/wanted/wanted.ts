// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// wanted.ts — sistem buronan server-side (P1-5, 05-hukum-kota §2).
//
// Record invisible di server: {wantedLevel, lastSeen, disguise} (05 §2.1).
// Hukum saklek: TANPA SAKSI = TANPA RECORD (05 §2.2 — mesin jujur).
// Eskalasi 0→5 dengan bobot membunuh > merusak > mencuri (05 §2.3).
// Gerbang kota menolak level ≥3 (05 §2.3) + blacklist per kota (05 §2.6).

/** Level maks buronan. */
export const WANTED_MAX = 5;

/** Level ≥3 = akses kota dibatasi (gerbang menolak, 05 §2.3). */
export const WANTED_GATE_LEVEL = 3;

/** Decay: 1 level per interval — ANGKA TUNABLE (blueprint tidak mematok;
 *  "heat = memori, bukan timer" 05 §3.5 → default sengaja panjang). */
export const WANTED_DECAY_INTERVAL_TICKS = 36_000; // ~1 jam @10 tick/detik

/** Radius saksi (06 §8.2: saksi dalam radius 50m). */
export const WITNESS_RADIUS_M = 50;

/** Bobot kejahatan — membunuh > merusak > mencuri (05 §2.2). */
export const CRIME_WEIGHT = { kill: 3, riot: 2, theft: 1 } as const;

export type CrimeKind = keyof typeof CRIME_WEIGHT;

export interface WantedRecord {
  playerId: string;
  wantedLevel: number;
  /** BUKAN live tracking — hanya diperbarui saat terlihat (05 §2.4). */
  lastSeen: { chunkKey: string; tick: number };
  disguise: boolean;
}

export interface WantedState {
  records: Record<string, WantedRecord>;
  blacklist: Record<string, string[]>;
  nextDecayTick: Record<string, number>;
}

export interface EscalateInput {
  crime?: CrimeKind;
  /** Delta langsung (mis. tabel hack: engine +2, alarm +3, cargo +4). */
  delta?: number;
  /** True minimal 1 saksi (pemain lain) dalam radius saat kejadian. */
  witnessed: boolean;
  tick: number;
  chunkKey?: string;
}

export type EscalateResult =
  | { applied: boolean; level: number; reason: string };

export function createWantedStore(initial?: Partial<WantedState>) {
  const records = new Map<string, WantedRecord>(Object.entries(initial?.records ?? {}));
  const blacklist = new Map<string, Set<string>>(
    Object.entries(initial?.blacklist ?? {}).map(([k, v]) => [k, new Set(v)])
  );
  const nextDecay = new Map<string, number>(Object.entries(initial?.nextDecayTick ?? {}));

  function getRecord(playerId: string): WantedRecord | undefined {
    return records.get(playerId);
  }

  function levelOf(playerId: string): number {
    return records.get(playerId)?.wantedLevel ?? 0;
  }

  return {
    getRecord,
    levelOf,

    /** Naikkan level — DI TOLAK tanpa saksi (05 §2.2). */
    escalate(playerId: string, input: EscalateInput): EscalateResult {
      if (!input.witnessed) {
        return { applied: false, level: levelOf(playerId), reason: "no witness — no record (05 §2.2)" };
      }
      const delta = input.delta ?? (input.crime ? CRIME_WEIGHT[input.crime] : 0);
      if (!Number.isInteger(delta) || delta <= 0) {
        return { applied: false, level: levelOf(playerId), reason: "invalid delta" };
      }
      const prev = records.get(playerId);
      const level = Math.min(WANTED_MAX, (prev?.wantedLevel ?? 0) + delta);
      const rec: WantedRecord = {
        playerId,
        wantedLevel: level,
        lastSeen: { chunkKey: input.chunkKey ?? prev?.lastSeen.chunkKey ?? "", tick: input.tick },
        disguise: prev?.disguise ?? false,
      };
      records.set(playerId, rec);
      if (!nextDecay.has(playerId)) nextDecay.set(playerId, input.tick + WANTED_DECAY_INTERVAL_TICKS);
      return { applied: true, level, reason: `+${delta} (${input.crime ?? "delta"})` };
    },

    /** Perbarui lastSeen saat buronan terlihat (radar/drone/pemain, 05 §2.4). */
    observe(playerId: string, tick: number, chunkKey: string): void {
      const rec = records.get(playerId);
      if (rec) rec.lastSeen = { chunkKey, tick };
    },

    /** Gerbang: level ≥ WANTED_GATE_LEVEL → kota ditolak (05 §2.3). */
    isGateBlocked(playerId: string): boolean {
      return levelOf(playerId) >= WANTED_GATE_LEVEL;
    },

    /** Blacklist per kota (05 §2.6) — kota = communityId stasiun. */
    addBlacklist(cityId: string, playerId: string): void {
      if (!blacklist.has(cityId)) blacklist.set(cityId, new Set());
      blacklist.get(cityId)!.add(playerId);
    },
    isBlacklisted(cityId: string, playerId: string): boolean {
      return blacklist.get(cityId)?.has(playerId) ?? false;
    },
    /** Keluar blacklist = selesaikan status (bebas/tangkap/tebus, 05 §2.6). */
    releaseBlacklist(cityId: string, playerId: string): void {
      blacklist.get(cityId)?.delete(playerId);
    },
    /** Turunkan wanted ke 0 (status selesai) + lepas dari semua blacklist. */
    clear(playerId: string): void {
      records.delete(playerId);
      nextDecay.delete(playerId);
      for (const set of blacklist.values()) set.delete(playerId);
    },

    setDisguise(playerId: string, on: boolean): void {
      const rec = records.get(playerId);
      if (rec) rec.disguise = on;
    },

    /** Decay per tick: 1 level per WANTED_DECAY_INTERVAL_TICKS. */
    decay(tick: number): string[] {
      const changed: string[] = [];
      for (const [playerId, due] of nextDecay) {
        if (tick < due) continue;
        const rec = records.get(playerId);
        if (!rec) { nextDecay.delete(playerId); continue; }
        rec.wantedLevel -= 1;
        nextDecay.set(playerId, due + WANTED_DECAY_INTERVAL_TICKS);
        if (rec.wantedLevel <= 0) {
          records.delete(playerId);
          nextDecay.delete(playerId);
        }
        changed.push(playerId);
      }
      return changed;
    },

    serialize(): WantedState {
      return {
        records: Object.fromEntries([...records].map(([k, v]) => [k, { ...v, lastSeen: { ...v.lastSeen } }])),
        blacklist: Object.fromEntries([...blacklist].map(([k, v]) => [k, [...v]])),
        nextDecayTick: Object.fromEntries(nextDecay),
      };
    },

    restore(state: WantedState): void {
      records.clear();
      for (const [k, v] of Object.entries(state.records ?? {})) records.set(k, { ...v, lastSeen: { ...v.lastSeen } });
      blacklist.clear();
      for (const [k, v] of Object.entries(state.blacklist ?? {})) blacklist.set(k, new Set(v));
      nextDecay.clear();
      for (const [k, v] of Object.entries(state.nextDecayTick ?? {})) nextDecay.set(k, v);
    },
  };
}

export type WantedStore = ReturnType<typeof createWantedStore>;
