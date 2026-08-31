// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
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

export function clampSpeed(v: Vec3, max: number): Vec3 {
  const s = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (s <= max) return { ...v };
  const k = max / s;
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}
