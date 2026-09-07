// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// vesselState.ts - 10.E Emergency Landing: ADRIFT->FALLING->CRASHED. Zoom dari blueprint 16 state machine visual + authority tipis.

// Blueprint 16: BATTLE health 100->12% -> ADRIFT drift 8->0 + emissive red -> FALLING gravitasi G + heat haze -> EMERGENCY LANDING raycast empty land + dust 4 fase + KE crash -> CRASHED health 5% persist + smoke.
// WIRE NOTE for SESSION 2: import { getVesselState, canThrust, applyGravity } from "./vesselState" di validator.ts + simulation.ts.

import type { Vec3 } from "./types";

export type VesselState = "nominal" | "adrift" | "falling" | "crashed";

export interface VesselStateInfo {
  state: VesselState;
  health: number; // 0..100
  velocity: Vec3;
  position: Vec3;
  canThrust: boolean;
  reason: string;
}

export function getVesselState(health: number, velocity: Vec3, position: Vec3, planetPos?: Vec3): VesselStateInfo {
  if (health >= 10) return { state: "nominal", health, velocity, position, canThrust: true, reason: "nominal health>=10%" };
  if (health < 10 && health > 5) {
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    if (speed > 1) return { state: "adrift", health, velocity, position, canThrust: false, reason: "adrift health<10% drift" };
    // If near planet gravity, transition to falling
    if (planetPos) {
      const dist = Math.hypot(position.x - planetPos.x, position.y - planetPos.y, position.z - planetPos.z);
      if (dist < 8000) return { state: "falling", health, velocity, position, canThrust: false, reason: "falling gravity pull" };
    }
    return { state: "adrift", health, velocity, position, canThrust: false, reason: "adrift" };
  }
  // health <=5
  return { state: "crashed", health, velocity, position, canThrust: false, reason: "crashed health<=5% grounded" };
}

export function canThrust(state: VesselState): boolean {
  return state === "nominal";
}

/** Apply gravity for falling: p+=v*dt + G*dt, drag 0.02, clamp. Visual only for presentation, authority tetap simulation.ts. */
export function applyGravity(pos: Vec3, vel: Vec3, planetPos: Vec3, dt: number, planetMass = 5.97e24): Vec3 {
  const G = 6.67430e-11;
  const dx = planetPos.x - pos.x, dy = planetPos.y - pos.y, dz = planetPos.z - pos.z;
  const r = Math.hypot(dx, dy, dz) || 6371000;
  const g = (G * planetMass) / (r * r); // 9.81 at surface
  const ax = (dx / r) * g * 0.00008; // scale for game units (dt 0.1)
  const ay = (dy / r) * g * 0.00008;
  const az = (dz / r) * g * 0.00008;
  let vx = vel.x + ax * dt - vel.x * 0.02 * dt;
  let vy = vel.y + ay * dt - vel.y * 0.02 * dt;
  let vz = vel.z + az * dt - vel.z * 0.02 * dt;
  // Clamp drift 0..120
  const speed = Math.hypot(vx, vy, vz);
  if (speed > 120) {
    const s = 120 / speed;
    vx *= s; vy *= s; vz *= s;
  }
  return { x: vx, y: vy, z: vz };
}
