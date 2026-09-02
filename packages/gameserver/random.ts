// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// random.ts — deterministic seeded PRNG (mulberry32).
// Production-grade replacement for ad-hoc `Math.sin(tick*9301 + seed*49297)`.
//
// Why: `Math.sin` floating-point is predictable per-run BUT its result is not
// bit-identical across environments/compilers, which breaks STRICT replay /
// cross-region reproducibility. mulberry32 is a plain 32-bit integer LCG with an
// explicit, serializable state — identical output on every platform for one seed.

export interface SeededRng {
  /** Next float in [0, 1). */
  next(): number;
  /** Fractional state handle — use getState/setState for full replay. */
  fract(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Returns true with probability p in [0,1]. */
  chance(p: number): boolean;
  /** Current 32-bit state — capture for `setSeedRngState` to replay. */
  getState(): number;
}

/** Create a deterministic PRNG from an integer seed (memorized 32-bit). */
export function createSeedRng(seed: number): SeededRng {
  let state = (Math.imul(seed | 0, 0x9e3779b9) + 0x6d2b79f5) | 0;
  if (state === 0) state = 0x9e3779b9;
  return rngFromState(state);
}

/** Rebuild a PRNG from a captured state (exact replay, e.g. hypervisor/confirm). */
export function setSeedRngState(state: number): SeededRng {
  return rngFromState(state | 0);
}

/** The mulberry32 core. Exposed so tests can drive raw state transitions. */
export function mulberry32(seed: number): () => number {
  let state = (Math.imul(seed | 0, 0x9e3779b9) + 0x6d2b79f5) | 0;
  if (state === 0) state = 0x9e3779b9;
  return next32FromState(state);
}

function next32FromState(initState: number): () => number {
  let state = initState;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFromState(initState: number): SeededRng {
  const state = { s: initState };
  const raw = (): number => {
    state.s = (state.s + 0x6d2b79f5) | 0;
    let t = state.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next: raw,
    fract: raw,
    range(min, max) {
      return min + (max - min) * raw();
    },
    int(min, max) {
      return Math.floor(raw() * (max - min + 1)) + min;
    },
    chance(p) {
      return raw() < p;
    },
    getState() {
      return state.s;
    },
  };
}