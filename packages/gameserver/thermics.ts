// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// thermics.ts — thermal physics (01 §2.6, D-020).
// Radiation ∝ 1/r² from star(s) → vessel temperature → material limit → melt/damage.

import type { Vec3, VesselEntity } from "./types";
import type { SystemBody } from "./environs";
import type { WorldRegion } from "./world";

const STEFAN_BOLTZMANN = 5.67e-8;
const SOLAR_LUMINOSITY = 3.8e26; // watts, scaled

export interface ThermalState {
  vesselId: string;
  temperature: number; // Kelvin
  overheat: boolean;
}

function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function computeThermal(region: WorldRegion, stars: SystemBody[]): ThermalState[] {
  const out: ThermalState[] = [];
  for (const e of region["entities"].values()) {
    if (e.kind !== "vessel") continue;
    const v = e as VesselEntity;
    let irradiance = 0;
    for (const star of stars) {
      if (star.kind !== "star") continue;
      const d = Math.max(1e6, dist(v.position, star.position));
      irradiance += SOLAR_LUMINOSITY / (4 * Math.PI * d * d);
    }
    // Simple temp: T = (irradiance / σ)^0.25 * 0.3 (scaled for gameplay)
    const temp = Math.pow(irradiance / STEFAN_BOLTZMANN, 0.25) * 0.03;
    const overheat = temp > 1200; // material limit
    if (overheat) {
      // Degrade subsystems (reuse cooldown as thermal stress)
      for (const sys of v.vessel.systems) sys.health = Math.max(0, sys.health - 2);
    }
    out.push({ vesselId: v.id, temperature: Math.round(temp), overheat });
  }
  return out;
}
