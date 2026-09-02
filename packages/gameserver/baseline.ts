// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// baseline.ts — D-019 Universal Baseline (gravity immunity + baseline physics).
// Added: time dilation per region (γ = 1/sqrt(1-v²/c²)) + per-region tick scaling — blueprint strengthening.

import type { Vec3 } from "./types";
import { createSeedRng } from "./random";

export const UNIVERSAL_BASELINE = {
  gravityConstant: 0,
  timeDilation: 1.0,
  maxEntitySpeed: 250,
  tickDuration: 0.1,
  lightSpeed: 299792458, // m/s — for γ
};

export function applyBaseline(state: { position: Vec3; velocity: Vec3 }, dt: number): Vec3 {
  const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2);
  const clamped = Math.min(speed, UNIVERSAL_BASELINE.maxEntitySpeed);
  if (speed > 0) {
    const scale = clamped / speed;
    return {
      x: state.velocity.x * scale * dt,
      y: state.velocity.y * scale * dt,
      z: state.velocity.z * scale * dt,
    };
  }
  return { x: 0, y: 0, z: 0 };
}

export function isWithinBaseline(entitySpeed: number): boolean {
  return entitySpeed <= UNIVERSAL_BASELINE.maxEntitySpeed;
}

export function computeTimeDilation(factor: number): number {
  return Math.max(0.1, Math.min(2.0, factor * UNIVERSAL_BASELINE.timeDilation));
}

// Relativistic γ — true physics, but clamp for game speed (v=250 → γ≈1) — D-019 strengthening
export function lorentzFactor(speed_mps: number): number {
  const c = UNIVERSAL_BASELINE.lightSpeed;
  const beta2 = Math.min(0.999999, (speed_mps * speed_mps) / (c * c));
  return 1 / Math.sqrt(1 - beta2);
}

export function dilatedTickDuration(speed_mps: number, baseTickDt: number = UNIVERSAL_BASELINE.tickDuration): number {
  const gamma = lorentzFactor(speed_mps);
  // Even at maxEntitySpeed, gamma ~1, so tick ~0.1 — but hook is ready for future high-speed regions
  return baseTickDt * gamma;
}

export function perRegionTimeDilation(regionId: string, tick: number, baseSpeed: number): number {
  // Deterministic per-region variation (0.98 — 1.02) — e.g., near-star region ticks slightly faster.
  // Seed by regionId+tick → identical output cross-env (replaces old Math.sin integer hash).
  const rng = createSeedRng(Math.imul(regionId.length, 0x9e3779b9) ^ Math.imul(tick, 0x6d2b79f5));
  const jitter = rng.range(0.98, 1.02);
  return dilatedTickDuration(baseSpeed) * jitter;
}
