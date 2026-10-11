// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// lifecycle.ts — umur aset/klaim (02-asset-pipeline §4, Sprint 5).
//
// Server MENCATAT `lastActiveTick` otoritatif (bukan jam klien). Aset yang
// 30 hari tak tersentuh → MONUMEN permanen (owner→world, nama pembangun di
// plakat). Reruntuhan (seeded 1-2 tahun) disiapkan deterministik dari hash
// assetId — kapan pun dijalankan hasilnya sama. Sentuh aset = hidupkan lagi.

/** 30 hari @10 tick/s. */
export const LIFECYCLE_MONUMENT_TICKS = 25_920_000;
/** 1 tahun @10 tick/s (reruntuhan awal; seeded 1-2th per aset). */
export const LIFECYCLE_RUIN_MIN_TICKS = 315_360_000;

export type LifecycleStateKind = "active" | "monument" | "ruin";

export interface LifecycleAsset {
  assetId: string;
  owner: string;
  plantedTick: number;
  lastActiveTick: number;
  state: LifecycleStateKind;
  monumentizedAtTick?: number;
  ruinSeededAtTick?: number;
}

export interface LifecycleState {
  assets: Record<string, LifecycleAsset>;
}

/** fnv-1a — deterministik, tanpa dep. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Tenggat reruntuhan seeded per aset (1-2 tahun). */
export function ruinDeadlineTicks(assetId: string): number {
  const frac = fnv1a(assetId) / 0xffffffff; // 0..1
  return LIFECYCLE_RUIN_MIN_TICKS + Math.floor(frac * LIFECYCLE_RUIN_MIN_TICKS);
}

export interface LifecycleTransition {
  assetId: string;
  from: LifecycleStateKind;
  to: LifecycleStateKind;
  tick: number;
  owner: string;
}

export function createLifecycleStore(initial?: LifecycleState) {
  const assets = new Map<string, LifecycleAsset>(
    Object.entries(initial?.assets ?? {}).map(([k, v]) => [k, { ...v }]),
  );

  return {
    /** Daftarkan aset (bangunan ditanam / klaim jadi sertifikat). */
    plant(assetId: string, owner: string, tick: number): LifecycleAsset {
      const a: LifecycleAsset = { assetId, owner, plantedTick: tick, lastActiveTick: tick, state: "active" };
      assets.set(assetId, a);
      return a;
    },

    get(assetId: string): LifecycleAsset | undefined {
      return assets.get(assetId);
    },

    /** Sentuh aset — reset penghitung 30 hari (hanya aset masih active). */
    touch(assetId: string, tick: number): boolean {
      const a = assets.get(assetId);
      if (!a || a.state !== "active") return false;
      a.lastActiveTick = tick;
      return true;
    },

    /**
     * Tick hook: transisi monumen/reruntuhan. Monumen = permanen (owner→world).
     * Kembalikan transisi yang terjadi (event log).
     */
    evaluate(tick: number): LifecycleTransition[] {
      const transitions: LifecycleTransition[] = [];
      for (const a of assets.values()) {
        if (a.state === "active" && tick - a.lastActiveTick >= LIFECYCLE_MONUMENT_TICKS) {
          a.state = "monument";
          a.monumentizedAtTick = tick;
          a.owner = "world";
          transitions.push({ assetId: a.assetId, from: "active", to: "monument", tick, owner: "world" });
        }
        if (a.state === "active") {
          const ruinAt = a.plantedTick + ruinDeadlineTicks(a.assetId);
          if (tick >= ruinAt) {
            a.state = "ruin";
            a.ruinSeededAtTick = ruinAt;
            transitions.push({ assetId: a.assetId, from: "active", to: "ruin", tick, owner: a.owner });
          }
        }
      }
      return transitions;
    },

    serialize(): LifecycleState {
      return { assets: Object.fromEntries([...assets].map(([k, v]) => [k, { ...v }])) };
    },

    restore(state: LifecycleState): void {
      assets.clear();
      for (const [k, v] of Object.entries(state?.assets ?? {})) assets.set(k, { ...v });
    },
  };
}

export type LifecycleStore = ReturnType<typeof createLifecycleStore>;
