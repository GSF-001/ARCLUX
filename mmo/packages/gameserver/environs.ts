// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// environs.ts — cosmic environs orbit integrator (01 §2.3, D-020).
// Deterministic per-tick Kepler integration for SystemBodies (star/planet/moon/asteroid/backdrop).
// No graphics — only authoritative positions for collision/thermics.

import type { Vec3 } from "./types";

export type BodyKind = "star" | "planet" | "moon" | "asteroid" | "belt" | "backdrop";
export type BodyId = string;

export interface SystemBody {
  id: BodyId;
  kind: BodyKind;
  /** Mass in kg (for gravity, not yet used for vessel pull — D-019 vessels are gravity-immune). */
  mass: number;
  /** Radius in meters (for collision). */
  radius: number;
  /** Orbit: Kepler elements around parent (star at 0,0,0 if no parentId). */
  orbit: {
    parentId?: BodyId;
    semiMajorAxis: number;
    eccentricity: number;
    periodTicks: number;
    phase: number;
    inclination?: number;
  };
  /** Current authoritative position (updated by integrateEnvirons). */
  position: Vec3;
  /** Whether vessel collision applies (backdrop/star surface may be non-collidable). */
  collidable: boolean;
}

export interface EnvironsState {
  bodies: Map<BodyId, SystemBody>;
  tick: number;
}

export function createEnvirons(bodies: SystemBody[]): EnvironsState {
  return { bodies: new Map(bodies.map((b) => [b.id, { ...b, position: { ...b.position } }])), tick: 0 };
}

/** Deterministic orbit position at tick t (Kepler circular approx — eccentricity handled via radius modulation). */
// Strengthened: anomaly perturbasi 5% via small GM/r² offset when body near anomaly zone (01 §2.3)
function orbitPos(body: SystemBody, tick: number, parentPos: Vec3): Vec3 {
  const { semiMajorAxis: a, eccentricity: e, periodTicks: p, phase, inclination = 0 } = body.orbit;
  const theta = (2 * Math.PI * (tick % p)) / p + phase;
  const r = a * (1 - e * e) / (1 + e * Math.cos(theta));
  let x = parentPos.x + r * Math.cos(theta) * Math.cos(inclination);
  let y = parentPos.y + r * Math.sin(theta) * Math.sin(inclination) * 0.3;
  let z = parentPos.z + r * Math.sin(theta);
  // Anomaly perturbasi: deterministic pseudo-anomaly at (a*0.7,0,0) with M=5e23kg — adds ≤5% wobble
  const anomalyPos: Vec3 = { x: a * 0.7, y: 0, z: 0 };
  const dx = x - anomalyPos.x, dy = y - anomalyPos.y, dz = z - anomalyPos.z;
  const rAnom = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (rAnom > 1e6 && rAnom < a * 2) {
    const GM = 6.67430e-11 * 5e23;
    const perturb = (GM / (rAnom * rAnom)) * 0.05; // 5% scaling so orbit stays stable
    x += (dx / rAnom) * perturb * 1e6;
    y += (dy / rAnom) * perturb * 1e6;
    z += (dz / rAnom) * perturb * 1e6;
  }
  return { x, y, z };
}

export function integrateEnvirons(state: EnvironsState): void {
  state.tick++;
  // Resolve parent ordering: star first, then planets, then moons (topological by parentId)
  const ordered = Array.from(state.bodies.values()).sort((a, b) => {
    if (!a.orbit.parentId && b.orbit.parentId) return -1;
    if (a.orbit.parentId && !b.orbit.parentId) return 1;
    return 0;
  });
  for (const body of ordered) {
    const parentPos = body.orbit.parentId ? state.bodies.get(body.orbit.parentId)?.position ?? { x: 0, y: 0, z: 0 } : { x: 0, y: 0, z: 0 };
    const newPos = orbitPos(body, state.tick, parentPos);
    const stored = state.bodies.get(body.id);
    if (stored) stored.position = newPos;
  }
}

export function getBodiesArray(state: EnvironsState): SystemBody[] {
  return Array.from(state.bodies.values());
}
