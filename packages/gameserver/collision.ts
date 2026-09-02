// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// collision.ts — vessel vs cosmic body collision (03 I.9, 04 wreckage).
// Deterministic, server-authoritative, physics-driven:
//   damage = kinetic energy × impact angle × penetration  → structural damage.
// Replaces the old `damage = severity * 100` heuristic so a head-on, high-speed,
// massive impact is meaningfully worse than a glancing nudge (03 I.9 emphasis).

import type { Vec3, VesselEntity } from "./types";
import type { SystemBody } from "./environs";
import type { WorldRegion } from "./world";

/** Reference values for normalizing kinetic energy into a 0..100 injury scale. */
const MASS_REF = 5e6; // kg — matches simulation's default vessel mass (simulation.ts).
const SPEED_REF = 250; // m/s — Universal Baseline maxEntitySpeed (D-019).
const VESSEL_MARGIN = 25; // m — safety envelope around the hull (stays from old heuristic).
/** Kinetic energy of the reference case → maps to full damage. */
export const KE_REF = 0.5 * MASS_REF * SPEED_REF * SPEED_REF; // ~1.56e11 J
/** Ceiling multiple of the reference KE before the energy term saturates. */
const ENERGY_SATURATION = 1.5;

export interface CollisionResult {
  collided: boolean;
  bodyId?: string;
  /** Aggregate structural damage 0..100 (energy × angle × penetration). */
  damage?: number;
  /** Kinetic energy of impact (J) — diagnostics. */
  energyJ?: number;
  /** Impact speed (m/s) — diagnostics. */
  impactSpeed?: number;
  destroyed?: boolean;
}

function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function speedOf(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** Impact angle factor in [0,1]: 1 = head-on into the body, →0 = glancing.
 *  Uses the unit vector from body center → vessel: motion against it (inward)
 *  is a direct hit; motion perpendicular/away is a graze. */
function impactAngleFactor(vessel: VesselEntity, body: SystemBody): number {
  const d = dist(vessel.position, body.position);
  if (d < 1e-6) return 1;
  const nx = (vessel.position.x - body.position.x) / d;
  const ny = (vessel.position.y - body.position.y) / d;
  const nz = (vessel.position.z - body.position.z) / d;
  // Velocity component aimed INTO the body center (already inwards = negative outward normal).
  const closure = -(vessel.velocity.x * nx + vessel.velocity.y * ny + vessel.velocity.z * nz);
  const sp = speedOf(vessel.velocity);
  if (sp < 1e-6) return 0;
  return Math.max(0, Math.min(1, closure / sp));
}

/** Mass of a vessel, mirroring simulation's convention (`vessel.mass ?? 5e6`). */
function vesselMass(vessel: VesselEntity): number {
  return (vessel as unknown as { vessel?: { mass?: number } }).vessel?.mass ?? MASS_REF;
}

/** Kinetic-energy damage: 0..100, saturated by `ENERGY_SATURATION × KE_REF`. */
function kineticDamage(vessel: VesselEntity): { damage: number; energyJ: number; impactSpeed: number } {
  const mass = vesselMass(vessel);
  const sp = speedOf(vessel.velocity);
  const energy = 0.5 * mass * sp * sp;
  const ratio = Math.min(ENERGY_SATURATION, energy / KE_REF);
  // damage 0..100 on the reference scale.
  return { damage: Math.ceil(ratio * 100), energyJ: energy, impactSpeed: sp };
}

/** Apply structural damage across a vessel's subsystem healths (deterministic). */
function applyStructuralDamage(vessel: VesselEntity, damage: number): number {
  let total = 0;
  if (vessel.vessel && Array.isArray(vessel.vessel.systems)) {
    for (const sys of vessel.vessel.systems) {
      if (typeof sys.health !== "number") continue;
      const before = sys.health;
      sys.health = Math.max(0, before - damage);
      total += before - sys.health;
    }
  }
  return total;
}

export function checkCollisions(region: WorldRegion, bodies: SystemBody[]): CollisionResult[] {
  const results: CollisionResult[] = [];
  for (const entity of region["entities"].values()) {
    if (entity.kind !== "vessel") continue;
    const vessel = entity as VesselEntity;
    for (const body of bodies) {
      if (!body.collidable) continue;
      const d = dist(vessel.position, body.position);
      if (d < body.radius + VESSEL_MARGIN) {
        const penetration = Math.max(0, (body.radius + VESSEL_MARGIN - d) / (body.radius + VESSEL_MARGIN));
        const { damage: keDamage, energyJ, impactSpeed } = kineticDamage(vessel);
        const angle = impactAngleFactor(vessel, body);
        // Damage = energy × head-onness × how deep it grinds in. cap at 100.
        const damage = Math.min(100, Math.ceil(keDamage * angle * (0.4 + 0.6 * penetration)));
        applyStructuralDamage(vessel, damage);

        // Destruction threshold: integrity of the vessel model (0..100) — material/hull rating.
        const integrity = vessel.vessel?.integrity ?? 80;
        const destroyed = damage >= integrity;

        results.push({ collided: true, bodyId: body.id, damage, energyJ, impactSpeed, destroyed });
        if (destroyed) {
          // Wreckage: remove vessel, caller can archive via packages/provenance.
          region.remove(vessel.id);
        }
        break;
      }
    }
  }
  return results;
}