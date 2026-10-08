// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// hack.ts — hack targets/loot server-side (P1-9, 06-gameplay-systems §3).
//
// Server yang memegang urutan tombol mini-game (deterministik dari seed —
// Math.random dilarang, E-5). Klien hanya mengirim `hack_input {keyIndex}`;
// sukses/gagal diputuskan di sini. Cooldown 60 detik per target (06 §3.5),
// 3 fail berturut = alarm + wanted +2 (06 §3.5).

/** Cooldown hack per target: 60 detik @10 tick/detik (06 §3.5). */
export const HACK_COOLDOWN_TICKS = 600;

/** Jarak hack: ≤10m dari kapal, ≤5m dari karakter FPS (06 §3.2). */
export const HACK_RANGE_SHIP_M = 10;
export const HACK_RANGE_FPS_M = 5;

/** Mini-game 4–6 tombol, random per attempt (06 §3.3) — deterministik. */
export const HACK_SEQ_MIN = 4;
export const HACK_SEQ_MAX = 6;
/** Tombol mini-game (indeks 0..5). */
export const HACK_BUTTONS = 6;

/** 3 fail berturut = alarm otomatis + wanted +2 (06 §3.5). */
export const HACK_MAX_FAILS = 3;
export const HACK_FAIL_ALARM_DELTA = 2;

export type HackTargetType = "door" | "camera" | "engine" | "alarm" | "cargo";

export const HACK_TARGET_TYPES: readonly HackTargetType[] = ["door", "camera", "engine", "alarm", "cargo"];

/** Delta wanted per target sukses (tabel 06 §3.4). */
export const HACK_WANTED_DELTA: Record<HackTargetType, number> = {
  door: 0,
  camera: 0,
  engine: 2,
  alarm: 3,
  cargo: 4,
};

/** Durasi efek (tick @10Hz) — null = permanen sampai repair (06 §3.4). */
export const HACK_EFFECT_TICKS: Record<HackTargetType, number | null> = {
  door: null,
  camera: 6_000, // 60 detik
  engine: 3_000, // 30 detik
  alarm: 12_000, // 120 detik
  cargo: null,
};

export interface HackAttempt {
  actorId: string;
  targetId: string;
  targetType: HackTargetType;
  /** Urutan tombol benar — dari rng seeded, bukan Math.random (E-5). */
  sequence: number[];
  progress: number;
  startTick: number;
}

export type HackStartResult =
  | { ok: true; attempt: HackAttempt }
  | { ok: false; reason: string };

export type HackInputResult =
  | { ok: true; status: "accepted"; progress: number; need: number }
  | { ok: true; status: "complete"; attempt: HackAttempt }
  | { ok: true; status: "wrong"; attempt: HackAttempt }
  | { ok: false; reason: string };

/** FNV-1a string → uint32 (seed deterministik, pola sama stationSeed). */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

interface FailCounter {
  count: number;
}

export function createHackStore() {
  const attempts = new Map<string, HackAttempt>();
  /** Fail beruntun per (actor::target) — reset saat sukses. */
  const fails = new Map<string, FailCounter>();

  function failKey(actorId: string, targetId: string): string {
    return `${actorId}::${targetId}`;
  }

  return {
    get(actorId: string): HackAttempt | undefined {
      return attempts.get(actorId);
    },

    start(args: { actorId: string; targetId: string; targetType: HackTargetType; tick: number; seed: number }): HackStartResult {
      if (attempts.has(args.actorId)) return { ok: false, reason: "hack attempt already in progress" };
      // rng deterministik dari seed pemanggil (bukan Math.random — E-5).
      let s = args.seed >>> 0;
      const next = (): number => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const len = HACK_SEQ_MIN + Math.floor(next() * (HACK_SEQ_MAX - HACK_SEQ_MIN + 1));
      const sequence: number[] = [];
      for (let i = 0; i < len; i++) sequence.push(Math.floor(next() * HACK_BUTTONS));
      const attempt: HackAttempt = { actorId: args.actorId, targetId: args.targetId, targetType: args.targetType, sequence, progress: 0, startTick: args.tick };
      attempts.set(args.actorId, attempt);
      return { ok: true, attempt };
    },

    input(actorId: string, keyIndex: number): HackInputResult {
      const attempt = attempts.get(actorId);
      if (!attempt) return { ok: false, reason: "no active hack attempt" };
      if (!Number.isInteger(keyIndex) || keyIndex < 0 || keyIndex >= HACK_BUTTONS) {
        return { ok: false, reason: `keyIndex must be integer 0..${HACK_BUTTONS - 1}` };
      }
      if (keyIndex !== attempt.sequence[attempt.progress]) {
        // Salah tombol → attempt gagal (06 §3.3).
        attempts.delete(actorId);
        return { ok: true, status: "wrong", attempt };
      }
      attempt.progress += 1;
      if (attempt.progress >= attempt.sequence.length) {
        attempts.delete(actorId);
        return { ok: true, status: "complete", attempt };
      }
      return { ok: true, status: "accepted", progress: attempt.progress, need: attempt.sequence.length };
    },

    cancel(actorId: string): boolean {
      return attempts.delete(actorId);
    },

    /** Catat fail; kembalian true = 3 fail berturut → alarm. */
    recordFail(actorId: string, targetId: string): boolean {
      const key = failKey(actorId, targetId);
      const entry = fails.get(key) ?? { count: 0 };
      entry.count += 1;
      fails.set(key, entry);
      if (entry.count >= HACK_MAX_FAILS) {
        fails.delete(key); // reset setelah alarm
        return true;
      }
      return false;
    },

    /** Sukses → reset counter fail beruntun. */
    recordSuccess(actorId: string, targetId: string): void {
      fails.delete(failKey(actorId, targetId));
    },

    failCount(actorId: string, targetId: string): number {
      return fails.get(failKey(actorId, targetId))?.count ?? 0;
    },

    serialize(): { attempts: HackAttempt[]; fails: Record<string, FailCounter> } {
      return { attempts: [...attempts.values()], fails: Object.fromEntries(fails) };
    },

    restore(state: { attempts?: HackAttempt[]; fails?: Record<string, FailCounter> }): void {
      attempts.clear();
      for (const a of state?.attempts ?? []) attempts.set(a.actorId, a);
      fails.clear();
      for (const [k, v] of Object.entries(state?.fails ?? {})) fails.set(k, v);
    },
  };
}

export type HackStore = ReturnType<typeof createHackStore>;
