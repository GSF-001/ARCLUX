// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// vesselState.ts - 10.E emergency flight authority.
//
// A battle-damaged vessel does not respawn: it goes ADRIFT (engines dead,
// drifting), gets captured by planetary gravity (FALLING), then settles into
// an EMERGENCY LANDING or CRASHED wreck that needs Repair-by-commit before
// it can fly again. All transitions are pure and deterministic; the persisted
// VesselEmergency flag on the entity carries state across ticks, snapshots,
// and restarts. Clients only render it.

import type { Vec3, VesselEntity } from "./types";
import type { VesselModel } from "../universe/types";

export type VesselState = "nominal" | "adrift" | "falling" | "crashed";

/** Hull below this enters ADRIFT (engines offline). */
export const ADRIFT_BELOW = 10;
/** Hull at or above this clears emergency (full repair). Hysteresis vs ADRIFT_BELOW. */
export const RECOVER_AT = 12;
/** Within this distance of a planet center, ADRIFT becomes FALLING. */
export const FALLING_RANGE = 8000;
/** Settled speed (m/s) below which a FALLING vessel touches down. */
export const SETTLE_SPEED = 2;
/** Clamp for gravity-driven fall speed (m/s). */
export const FALL_SPEED_MAX = 120;
/** Per-tick velocity damping while adrift (drift decays to zero). */
export const ADRIFT_DAMPING = 0.5;
/** Game-unit scale for Newtonian gravity at region scale. */
export const GRAVITY_SCALE = 0.00008;
/** Newtonian gravitational constant. */
export const GRAVITY_G = 6.6743e-11;

export interface VesselStateInfo {
  state: VesselState;
  health: number; // 0..100 hull aggregate
  velocity: Vec3;
  position: Vec3;
  canThrust: boolean;
  reason: string;
}

/** Hull integrity as the mean of live subsystem health (0..100). */
export function hullOf(vessel: VesselModel): number {
  const systems = vessel.systems;
  if (!systems || systems.length === 0) return 100;
  let sum = 0;
  for (const s of systems) sum += Math.max(0, Math.min(100, s.health));
  return sum / systems.length;
}

function speedOf(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function distanceTo(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Pure classifier: hull + motion + planet proximity -> flight state.
 * Kept for presentation use and tests; the persisted transition machine is
 * nextEmergencyState below.
 */
export function getVesselState(
  health: number,
  velocity: Vec3,
  position: Vec3,
  planetPos?: Vec3,
): VesselStateInfo {
  if (health >= ADRIFT_BELOW) {
    return { state: "nominal", health, velocity, position, canThrust: true, reason: "nominal" };
  }
  const nearPlanet = planetPos !== undefined && distanceTo(position, planetPos) < FALLING_RANGE;
  if (nearPlanet && speedOf(velocity) > SETTLE_SPEED) {
    return { state: "falling", health, velocity, position, canThrust: false, reason: "gravity-capture" };
  }
  return { state: "adrift", health, velocity, position, canThrust: false, reason: "engines-offline" };
}

export function canThrust(state: VesselState): boolean {
  return state === "nominal";
}

/**
 * Advance the persisted emergency flag one tick. Returns the effective state
 * and whether the flag changed (callers log transitions as GameEvents).
 *
 * nominal -> adrift  when hull < ADRIFT_BELOW
 * adrift  -> falling when within FALLING_RANGE of a planet
 * falling -> crashed when settled (slow near planet) — touchdown
 * any     -> nominal when hull >= RECOVER_AT (Repair-by-commit)
 * crashed persists until recovery; a crashed vessel never drifts.
 */
export function nextEmergencyState(
  vessel: VesselEntity,
  planetPos: Vec3 | undefined,
  tick: number,
): { state: VesselState; changed: boolean; cause: string } {
  const hull = hullOf(vessel.vessel);
  const prev = vessel.emergency?.state;

  if (hull >= RECOVER_AT) {
    if (!prev) return { state: "nominal", changed: false, cause: "nominal" };
    return { state: "nominal", changed: true, cause: "repaired" };
  }
  if (hull >= ADRIFT_BELOW) {
    // Damaged but flyable band: keep any existing flag until it resolves.
    if (!prev) return { state: "nominal", changed: false, cause: "nominal" };
    if (prev === "crashed") return { state: "crashed", changed: false, cause: "awaiting-repair" };
    return { state: prev, changed: false, cause: "recovering" };
  }

  // Hull below flight minimum.
  const nearPlanet = planetPos !== undefined && distanceTo(vessel.position, planetPos) < FALLING_RANGE;
  const moving = speedOf(vessel.velocity) > SETTLE_SPEED;
  if (prev === "crashed") return { state: "crashed", changed: false, cause: "wreck" };
  if (prev === "falling") {
    if (!moving) return { state: "crashed", changed: true, cause: "settled" };
    return { state: "falling", changed: false, cause: "falling" };
  }
  if (nearPlanet && moving) return { state: "falling", changed: true, cause: "gravity-capture" };
  if (!prev) return { state: "adrift", changed: true, cause: "hull-critical" };
  return { state: "adrift", changed: false, cause: "adrift" };
}

/**
 * Newtonian gravity step toward a planet center with light drag and a fall
 * clamp. Pure: returns the new velocity, mutates nothing.
 */
export function applyGravity(
  pos: Vec3,
  vel: Vec3,
  planetPos: Vec3,
  dt: number,
  planetMass = 5.972e24,
): Vec3 {
  const dx = planetPos.x - pos.x;
  const dy = planetPos.y - pos.y;
  const dz = planetPos.z - pos.z;
  const r = Math.hypot(dx, dy, dz) || 6371000;
  const g = ((GRAVITY_G * planetMass) / (r * r)) * GRAVITY_SCALE;
  const damp = 1 - 0.02 * dt;
  let vx = (vel.x + (dx / r) * g * dt) * damp;
  let vy = (vel.y + (dy / r) * g * dt) * damp;
  let vz = (vel.z + (dz / r) * g * dt) * damp;
  const speed = Math.hypot(vx, vy, vz);
  if (speed > FALL_SPEED_MAX) {
    const s = FALL_SPEED_MAX / speed;
    vx *= s;
    vy *= s;
    vz *= s;
  }
  return { x: vx, y: vy, z: vz };
}

/**
 * Touchdown verdict from impact kinematics and terrain. KE = 1/2 m v^2
 * against an allowable budget scaled by approach angle and slope.
 * Returns "landed" (survives, needs repair) or "wrecked" (hull loss).
 */
export function landingOutcome(opts: {
  mass: number;
  speed: number;
  verticalSpeed: number;
  slope: number;
  onEmptyLand: boolean;
}): { verdict: "landed" | "wrecked"; kineticEnergy: number; budget: number } {
  const kineticEnergy = 0.5 * opts.mass * opts.speed * opts.speed;
  const slopeFactor = 1 + Math.min(1, opts.slope) * 2;
  const budget = 0.5 * opts.mass * 25 * 25 * slopeFactor * (opts.onEmptyLand ? 1 : 0.4);
  const hardImpact = opts.verticalSpeed < -18;
  const verdict = kineticEnergy <= budget && !hardImpact ? "landed" : "wrecked";
  return { verdict, kineticEnergy, budget };
}
