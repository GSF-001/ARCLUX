// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// capSim.ts — Fase 1 capacitor simulation (blueprint 11 §5).
//
// Deterministic per-tick simulation of a vessel capacitor:
//
//   level(t+1) = clamp(level(t) − draw + regen, 0, capacity)
//
// The dashboard projects the curve live (Pyfa's capSim.py
// pattern, clean-room reimplemented); the gameserver runs
// the identical function authoritatively each tick, so
// client and server can never disagree about depletion.
//
// Design laws (same as fitCalc): pure, deterministic,
// fixed-point (round2 each tick), no clock, no randomness.

import type { ComponentDefinition } from "./types";

/** Below this fraction of capacity the capacitor warns. */
export const CAP_WARNING_THRESHOLD = 0.25;

export interface CapacitorState {
  /** Max capacitor level. */
  capacity: number;
  /** Current level (0..capacity). */
  current: number;
  /** Regeneration per tick. */
  regenPerTick: number;
}

export interface CapTick {
  tick: number;
  /** Capacitor level at the END of this tick. */
  level: number;
  /** True when level hit 0 (depleted — no activation possible). */
  depleted: boolean;
  /** True when level < warning threshold. */
  warning: boolean;
}

export type CapSimVerdict = "stable" | "sustainable" | "unstable";

export interface CapSimResult {
  /** Per-tick history, oldest first. */
  history: CapTick[];
  /** Lowest level reached across the horizon. */
  minLevel: number;
  /** Level at the end of the horizon. */
  endLevel: number;
  /** First tick that ended depleted (undefined if never). */
  firstDepletionTick?: number;
  /** Fraction of ticks spent below the warning threshold. */
  warningRatio: number;
  /**
   * stable     — draw ≤ regen: level never falls
   * sustainable — draw > regen but the horizon completes
   *               without depletion
   * unstable   — depleted within the horizon
   */
  verdict: CapSimVerdict;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Simulate `ticks` ticks of capacitor drain. Pure: the input
 * state is never mutated. Negative ticks are treated as 0;
 * a zero-capacity capacitor is always depleted.
 */
export function simulateCapacitor(
  state: CapacitorState,
  drawPerTick: number,
  ticks: number
): CapSimResult {
  const capacity = Math.max(0, state.capacity);
  const draw = Math.max(0, drawPerTick);
  const regen = Math.max(0, state.regenPerTick);
  const horizon = Math.max(0, Math.floor(ticks));

  const history: CapTick[] = [];
  let level = clamp(round2(state.current), 0, capacity);
  let minLevel = level;
  let firstDepletionTick: number | undefined;
  let warningTicks = 0;

  for (let tick = 1; tick <= horizon; tick++) {
    level = clamp(round2(level - draw + regen), 0, capacity);
    const depleted = level <= 0;
    const warning = level <= capacity * CAP_WARNING_THRESHOLD;
    if (depleted && firstDepletionTick === undefined) firstDepletionTick = tick;
    if (warning) warningTicks++;
    if (level < minLevel) minLevel = level;
    history.push({ tick, level, depleted, warning });
  }

  const warningRatio = horizon === 0 ? 0 : round2(warningTicks / horizon);
  const endLevel = level;

  const verdict: CapSimVerdict =
    draw <= regen ? "stable" : firstDepletionTick === undefined ? "sustainable" : "unstable";

  return { history, minLevel, endLevel, firstDepletionTick, warningRatio, verdict };
}

/**
 * Total per-tick draw of a fit — the input to simulateCapacitor.
 * Deterministic: sum over the sorted-by-id component set.
 */
export function capacitorBudget(definitions: ComponentDefinition[]): number {
  return definitions
    .map((d) => d.powerDraw)
    .reduce((sum, draw) => sum + draw, 0);
}

/**
 * Minimum regen for a stable capacitor at a given draw
 * (regen ≥ draw keeps the level from ever falling).
 */
export function requiredRegenForStability(drawPerTick: number): number {
  return Math.max(0, drawPerTick);
}

/**
 * Maximum draw a capacitor can sustain indefinitely at a
 * given regen (the inverse of requiredRegenForStability).
 */
export function sustainableDraw(regenPerTick: number): number {
  return Math.max(0, regenPerTick);
}
