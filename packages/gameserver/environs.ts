// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
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
function orbitPos(body: SystemBody, tick: number, parentPos: Vec3): Vec3 {
  const { semiMajorAxis: a, eccentricity: e, periodTicks: p, phase, inclination = 0 } = body.orbit;
  const theta = (2 * Math.PI * (tick % p)) / p + phase;
  const r = a * (1 - e * e) / (1 + e * Math.cos(theta));
  const x = parentPos.x + r * Math.cos(theta) * Math.cos(inclination);
  const y = parentPos.y + r * Math.sin(theta) * Math.sin(inclination) * 0.3;
  const z = parentPos.z + r * Math.sin(theta);
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
