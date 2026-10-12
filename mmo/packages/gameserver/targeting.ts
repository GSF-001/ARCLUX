// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// targeting.ts — lock-on & targeting server-authoritative (09-combat-depth §2,
// Sprint 7 PR-A).
//
// Prinsip §0: lock di-derive dari GEOMETRY (jarak, cone, mode, safe-zone) yang
// dihitung server — bukan klaim client. Missile wajib locked; turret cukup
// target valid. Store VOLATILE (restore bersih = fair, §0.6). Semua angka =
// named constant tunable. Tidak ada Math.random/Date.now di sim path (E-5).

import type { VesselEntity, WorldEntity } from "./types";
import type { WorldRegion } from "./world";
import type { SessionStore } from "./session";
import { distanceBetween } from "./world";
import { signatureOf } from "./stats";
import { fitDefinitionsOf } from "./fitting";
import { isInSafeZone } from "./governance";
import { hullOf } from "./vesselState";

// ── Angka balance (semua tunable tanpa menyentuh logika) ──────────────────

/** Jarak dasar akuisisi lock (8 km). */
export const LOCK_RANGE_BASE_M = 8_000;
/** Bonus jarak per komponen sensor (security/search/graph) terpasang. */
export const LOCK_RANGE_SENSOR_BONUS_M = 1_500;
/** Cone menghadap target (derajat) — kapal harus "menghadap" (§2.2). */
export const LOCK_CONE_DEG = 45;
/** Tick akuisisi per kelas target @10Hz (0.8/1.5/3 dtk — §2.2). */
export const LOCK_ACQUIRE_TICKS: Record<"corvette" | "cruiser" | "capital", number> = {
  corvette: 8,
  cruiser: 15,
  capital: 30,
};
/** Grace saat syarat hilang — flicker sensor tak langsung merusak lock. */
export const LOCK_BREAK_GRACE_TICKS = 4;
/** Re-lock target SAMA dalam window ini → progress lanjut 50% (§2.2). */
export const LOCK_RELOCK_WINDOW_TICKS = 100;
export const LOCK_RELOCK_PROGRESS_FACTOR = 0.5;
/** Anti spam re-lock: cooldown intent lock per kapal (§2.3). */
export const LOCK_INTENT_COOLDOWN_TICKS = 2;
/** Komponen yang dihitung sebagai sensor untuk bonus range (§2.2). */
export const LOCK_SENSOR_CAPABILITY_RE = /^(security|search|graph)\./;

// ── Model data (§2.1) ─────────────────────────────────────────────────────

export type LockPhase = "acquiring" | "locked" | "breaking";

export type LockBreakReason =
  | "out_of_range"
  | "out_of_cone"
  | "safety_boundary"
  | "mode_switch"
  | "target_destroyed"
  | "manual";

export interface LockState {
  attackerId: string;
  targetId: string;
  startedTick: number;
  /** 0..need — naik 1/tick selama semua syarat terpenuhi (§2.2). */
  progress: number;
  need: number;
  phase: LockPhase;
  /** Hitung grace saat phase="breaking". */
  breakingFor: number;
}

/** Memori per penyerang: lock aktif + break terakhir (untuk re-lock 50%). */
export interface LockMemory {
  current?: LockState;
  recentBreak?: { targetId: string; brokenTick: number };
}

export type LockStore = ReturnType<typeof createLockStore>;

/** Store volatile per-region (bukan Map langsung — konsisten dgn store lain). */
export function createLockStore() {
  const mem = new Map<string, LockMemory>();
  return {
    memoryOf(attackerId: string): LockMemory {
      return mem.get(attackerId) ?? {};
    },
    setMemory(attackerId: string, m: LockMemory): void {
      mem.set(attackerId, m);
    },
    current(attackerId: string): LockState | undefined {
      return mem.get(attackerId)?.current;
    },
    entries(): IterableIterator<[string, LockMemory]> {
      return mem.entries();
    },
    clearAll(): void {
      mem.clear();
    },
    get size(): number {
      return mem.size;
    },
  };
}

// ── Derivasi (§2.2) ───────────────────────────────────────────────────────

/**
 * Signature target — delegasi `stats.ts::signatureOf` (satu sumber, §5.1).
 * Kapal tebal = gampang dilacak, kapal ringan = susah (EVE-like
 * disederhanakan).
 */
export function targetSignatureOf(target: WorldEntity): number {
  return signatureOf(target);
}

/** Kelas target untuk tabel akuisisi (§2.2) — deterministik dari signature. */
export function targetClassOf(target: WorldEntity): "corvette" | "cruiser" | "capital" {
  const sig = targetSignatureOf(target);
  if (sig < 50) return "corvette";
  if (sig < 70) return "cruiser";
  return "capital";
}

/** sensorFactor = clamp(1.3 − signature/200, 0.5, 1.5) — kapal kecil susah. */
export function lockSensorFactor(target: WorldEntity): number {
  return Math.max(0.5, Math.min(1.5, 1.3 - targetSignatureOf(target) / 200));
}

/** Jarak lock efektif penyerang: 8 km + bonus sensor terpasang (§2.2). */
export function lockRangeOf(attacker: VesselEntity): number {
  let bonus = 0;
  for (const def of fitDefinitionsOf(attacker.vessel)) {
    if (LOCK_SENSOR_CAPABILITY_RE.test(def.capability)) bonus += LOCK_RANGE_SENSOR_BONUS_M;
  }
  return LOCK_RANGE_BASE_M + bonus;
}

/** Need = BASE[kelas] × sensorFactor, min 1 tick. */
export function lockNeedFor(target: WorldEntity): number {
  const base = LOCK_ACQUIRE_TICKS[targetClassOf(target)];
  return Math.max(1, Math.round(base * lockSensorFactor(target)));
}

/** Forward unit dari heading vessel (konsisten dgn moveToward atan2). */
function forwardOf(v: { heading: { yaw: number; pitch: number } }): { x: number; y: number; z: number } {
  const { yaw, pitch } = v.heading;
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  };
}

/** Angle (derajat) antara haluan penyerang dan arah ke target. */
/** Sudut heading vs posisi absolut (satu sumber cone — lock + point defense). */
export function angleToPosDeg(
  v: { heading: { yaw: number; pitch: number }; position: { x: number; y: number; z: number } },
  pos: { x: number; y: number; z: number }
): number {
  const f = forwardOf(v);
  const dx = pos.x - v.position.x;
  const dy = pos.y - v.position.y;
  const dz = pos.z - v.position.z;
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return 0;
  const cos = (f.x * dx + f.y * dy + f.z * dz) / len;
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export function lockAngleDeg(attacker: VesselEntity, target: WorldEntity): number {
  return angleToPosDeg(attacker, target.position);
}

// ── Transisi lock (§2.2-2.4) ──────────────────────────────────────────────

export interface LockTransition {
  type: "lock_acquired" | "lock_broken";
  attackerId: string;
  targetId: string;
  reason?: LockBreakReason;
  need?: number;
  progress?: number;
}

/**
 * Mulai / ganti lock dari intent `lock` (§2.3). Target berbeda = progress 0;
 * target sama saat masih locked/acquiring = no-op; re-lock setelah putus dalam
 * window 100 tick = lanjut 50% (anti kite lock-reset).
 */
export function startLock(
  store: LockStore,
  attacker: VesselEntity,
  targetId: string,
  tick: number
): { started: boolean; state?: LockState; reason?: string } {
  const memory = store.memoryOf(attacker.id);
  const cur = memory.current;
  if (cur && cur.targetId === targetId) {
    return { started: false, reason: "lock already active on target" };
  }
  const recent = memory.recentBreak;
  const reuse =
    recent && recent.targetId === targetId && tick - recent.brokenTick < LOCK_RELOCK_WINDOW_TICKS;
  const state: LockState = {
    attackerId: attacker.id,
    targetId,
    startedTick: tick,
    progress: 0,
    // need dihitung caller (lockNeedFor butuh entity target asli) via
    // applyLockNeed — re-lock 50% juga diterapkan di sana.
    need: 0,
    phase: "acquiring",
    breakingFor: 0,
  };
  store.setMemory(attacker.id, { ...memory, current: state, recentBreak: reuse ? recent : undefined });
  return { started: true, state };
}

/** Set need hasil hitung caller (dipisah supaya startLock tanpa region). */
export function applyLockNeed(store: LockStore, attackerId: string, need: number): void {
  const m = store.memoryOf(attackerId);
  if (!m.current) return;
  const cur = m.current;
  const relock = m.recentBreak === undefined ? false : true;
  m.current = {
    ...cur,
    need,
    progress: relock ? Math.floor(need * LOCK_RELOCK_PROGRESS_FACTOR) : 0,
  };
}

/** Hapus lock (break / destroy / manual) + simpan memori re-lock. */
export function breakLock(
  store: LockStore,
  attackerId: string,
  tick: number,
  reason: LockBreakReason
): LockTransition | undefined {
  const m = store.memoryOf(attackerId);
  const cur = m.current;
  if (!cur) return undefined;
  store.setMemory(attackerId, {
    current: undefined,
    recentBreak: reason === "target_destroyed" ? undefined : { targetId: cur.targetId, brokenTick: tick },
  });
  return { type: "lock_broken", attackerId, targetId: cur.targetId, reason, need: cur.need, progress: cur.progress };
}

/** Intent `unlock` — lepas manual: reset penuh (tanpa memori re-lock). */
export function releaseLock(store: LockStore, attackerId: string): LockTransition | undefined {
  const m = store.memoryOf(attackerId);
  if (!m.current) return undefined;
  store.setMemory(attackerId, {});
  return {
    type: "lock_broken",
    attackerId,
    targetId: m.current.targetId,
    reason: "manual",
    need: m.current.need,
    progress: m.current.progress,
  };
}

// ── stepLocks (§2.4) — dipanggil SimulationEngine tiap tick ───────────────

/**
 * Update semua lock aktif untuk satu tick. Urutan: intents → locks →
 * projectiles (§3.2). Syarat progress naik (§2.2): jarak, cone, mode ship
 * keduanya, pasangan safe-zone sama. Syarat hilang → grace 4 tick → break.
 */
export function stepLocks(
  region: WorldRegion,
  store: LockStore,
  tick: number,
  sessions?: SessionStore
): LockTransition[] {
  const out: LockTransition[] = [];
  for (const [attackerId, memory] of store.entries()) {
    const cur = memory.current;
    if (!cur) continue;
    const attacker = region.get(attackerId);
    const target = region.get(cur.targetId);

    // 1. Target mati/hilang → break instan (tanpa grace — tak bisa dikejar).
    if (!target || (target.kind === "vessel" && hullOf(target.vessel) <= 0)) {
      out.push(breakLock(store, attackerId, tick, "target_destroyed")!);
      continue;
    }
    if (!attacker || attacker.kind !== "vessel") {
      out.push(breakLock(store, attackerId, tick, "target_destroyed")!);
      continue;
    }

    // 2. Syarat per tick (§2.2) — semua harus true agar progress naik.
    let reason: LockBreakReason | undefined;
    const dist = distanceBetween(attacker, target);
    if (dist > lockRangeOf(attacker)) reason = "out_of_range";
    else if (lockAngleDeg(attacker, target) > LOCK_CONE_DEG) reason = "out_of_cone";
    else if (sessions) {
      // Mode gate: keduanya harus di mode ship (06 §2.5).
      const aMode = sessions.modeOf(attacker.owner ?? "");
      const tMode = sessions.modeOf(target.owner ?? "");
      if (aMode !== "ship" || tMode !== "ship") reason = "mode_switch";
      else {
        // Pasangan safe-zone: zona berbeda (termasuk null vs station) = break.
        const aZone = isInSafeZone(region, attacker.position);
        const tZone = isInSafeZone(region, target.position);
        if ((aZone?.id ?? null) !== (tZone?.id ?? null)) reason = "safety_boundary";
      }
    }

    if (!reason) {
      const st = memory.current!;
      if (st.phase === "breaking") {
        // Recover: syarat kembali dalam grace → lanjut akuisisi (§2.6 #2).
        st.phase = "acquiring";
        st.breakingFor = 0;
      }
      if (st.phase === "acquiring") {
        st.progress += 1;
        if (st.need > 0 && st.progress >= st.need) {
          st.phase = "locked";
          out.push({ type: "lock_acquired", attackerId, targetId: st.targetId, need: st.need, progress: st.progress });
        }
      }
      continue;
    }

    // 3. Syarat hilang → grace, lalu break (§2.2).
    const st = memory.current!;
    if (st.phase !== "breaking") {
      st.phase = "breaking";
      st.breakingFor = 0;
    }
    st.breakingFor += 1;
    if (st.breakingFor >= LOCK_BREAK_GRACE_TICKS) {
      out.push(breakLock(store, attackerId, tick, reason)!);
    }
  }
  return out;
}
