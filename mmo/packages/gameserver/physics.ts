// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// physics.ts — Newtonian helper presisi (G, σ, c, Kepler, 1/r²).
// Semua rumus blueprint kasar di-fix di sini biar gak brantakan — 01 §2.3 / D-019 / D-020.

import type { Vec3 } from "./types";

export const PHYS = {
  G: 6.67430e-11, // m³ kg⁻¹ s⁻²
  STEFAN: 5.670374419e-8, // W m⁻² K⁻⁴
  LIGHT: 299792458, // m/s
  SOLAR_LUMINOSITY: 3.828e26, // W
  SOLAR_MASS_LOSS: 1e9, // kg/s
  SOLAR_WIND_SPEED: 4e5, // m/s
  AU: 1.496e11, // m
};

export function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function gravityAccel(mass_kg: number, r_m: number): number {
  const r = Math.max(1e6, r_m);
  return (PHYS.G * mass_kg) / (r * r);
}

export function orbitSpeed(mass_kg: number, semiMajorAxis_m: number): number {
  return Math.sqrt((PHYS.G * mass_kg) / Math.max(1e6, semiMajorAxis_m));
}

export function thermalTemp(luminosity_W: number, distance_m: number): number {
  const flux = luminosity_W / (4 * Math.PI * Math.max(1e9, distance_m) ** 2);
  return Math.pow(flux / PHYS.STEFAN, 0.25);
}

export function solarWindPressure(distance_m: number): number {
  return (PHYS.SOLAR_MASS_LOSS * PHYS.SOLAR_WIND_SPEED) / (4 * Math.PI * Math.max(1e9, distance_m) ** 2);
}

export function lorentz(speed_mps: number): number {
  const beta2 = Math.min(0.999999, (speed_mps * speed_mps) / (PHYS.LIGHT * PHYS.LIGHT));
  return 1 / Math.sqrt(1 - beta2);
}

/**
 * Newtonian thrust steer (D-019 baseline): a=4 m/s², cap 250 m/s. Dipakai
 * move intent (simulation) DAN NPC AI (npcBrain) — satu sumber gerak.
 * Heading ikut di-set ke arah gerak (atan2) — konsisten lock/PD cone.
 */
export function steerToward(
  entity: { position: Vec3; velocity: Vec3; heading: { yaw: number; pitch: number }; vessel?: { mass?: number } | object },
  target: Vec3,
  dt: number
): void {
  const thrust = 2e7;
  const mass = (entity.vessel as { mass?: number } | undefined)?.mass ?? 5e6;
  const maxSpeed = 250;
  const dx = target.x - entity.position.x;
  const dy = target.y - entity.position.y;
  const dz = target.z - entity.position.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 1) {
    entity.velocity.x *= 0.85;
    entity.velocity.y *= 0.85;
    entity.velocity.z *= 0.85;
    if (Math.sqrt(entity.velocity.x ** 2 + entity.velocity.y ** 2 + entity.velocity.z ** 2) < 0.5) {
      entity.velocity.x = 0; entity.velocity.y = 0; entity.velocity.z = 0;
    }
    return;
  }
  const ax = (dx / d) * (thrust / mass);
  const ay = (dy / d) * (thrust / mass);
  const az = (dz / d) * (thrust / mass);
  entity.velocity.x = Math.max(-maxSpeed, Math.min(maxSpeed, entity.velocity.x + ax * dt));
  entity.velocity.y = Math.max(-maxSpeed, Math.min(maxSpeed, entity.velocity.y + ay * dt));
  entity.velocity.z = Math.max(-maxSpeed, Math.min(maxSpeed, entity.velocity.z + az * dt));
  entity.heading.yaw = Math.atan2(dx, dz);
  entity.heading.pitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
}

export function clampSpeed(v: Vec3, max: number): Vec3 {
  const s = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (s <= max) return { ...v };
  const k = max / s;
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}
