// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// cosmicEvent.ts — cosmic event generator (01 §2.5, 03 I.8).
// Deterministic pseudo-random per tick: meteor shower, solar storm, aurora, anomaly.
// Added: solarWind (Ṁ·v/4πr² pressure) + anomaly gravity well (a=GM/r² perturbasi).

import type { EnvironsState } from "./environs";
import type { Vec3 } from "./types";

export type CosmicEventKind = "meteor_shower" | "solar_storm" | "aurora" | "anomaly_debris" | "solar_wind" | "anomaly_gravity";

export interface CosmicEvent {
  id: string;
  tick: number;
  kind: CosmicEventKind;
  severity: number; // 0-100
  regionId: string;
  payload: Record<string, unknown>;
}

function pseudoRandom(tick: number, seed: number): number {
  const x = Math.sin(tick * 9301 + seed * 49297) * 233280;
  return x - Math.floor(x);
}

export function generateCosmicEvents(state: EnvironsState, regionId: string, tick: number): CosmicEvent[] {
  const out: CosmicEvent[] = [];
  // Meteor shower: ~0.5% per tick
  if (pseudoRandom(tick, 1) < 0.005) {
    out.push({ id: `cosmic:${tick}:meteor`, tick, kind: "meteor_shower", severity: Math.floor(pseudoRandom(tick, 2) * 60 + 20), regionId, payload: { count: Math.floor(pseudoRandom(tick, 3) * 8 + 2) } });
  }
  // Solar storm: ~0.2% per tick, linked to star phase
  if (pseudoRandom(tick, 4) < 0.002) {
    out.push({ id: `cosmic:${tick}:storm`, tick, kind: "solar_storm", severity: Math.floor(pseudoRandom(tick, 5) * 40 + 60), regionId, payload: { starId: "star-1" } });
  }
  // Aurora: ~1% per tick, low severity
  if (pseudoRandom(tick, 6) < 0.01) {
    out.push({ id: `cosmic:${tick}:aurora`, tick, kind: "aurora", severity: Math.floor(pseudoRandom(tick, 7) * 30 + 10), regionId, payload: {} });
  }
  // Solar wind: ~0.8% per tick — Newtonian P = Ṁ·v / 4πr² (01 §2.5 strengthening)
  if (pseudoRandom(tick, 8) < 0.008) {
    const r = 1.5e11; // ~1 AU reference
    const p = computeSolarWindPressure(r);
    out.push({ id: `cosmic:${tick}:wind`, tick, kind: "solar_wind", severity: Math.floor(Math.min(100, p * 1e9 * 10)), regionId, payload: { pressure_Pa: p, starId: "star-1" } });
  }
  // Anomaly gravity well: ~0.3% per tick — a = GM/r² perturbasi orbit (01 §2.3)
  if (pseudoRandom(tick, 9) < 0.003) {
    const anomalyMass = 1e24 * (0.5 + pseudoRandom(tick, 10));
    const rAnomaly = 5e10 + pseudoRandom(tick, 11) * 5e10;
    const a = computeAnomalyAccel(anomalyMass, rAnomaly);
    out.push({ id: `cosmic:${tick}:anomaly`, tick, kind: "anomaly_gravity", severity: Math.floor(Math.min(100, a * 1e6)), regionId, payload: { mass_kg: anomalyMass, distance_m: rAnomaly, accel_mps2: a } });
  }
  return out;
}

// Solar wind pressure — Newtonian: P = Ṁ·v / 4πr² (Ṁ = solar mass loss, v = wind speed) — 01 §2.5
const SOLAR_MASS_LOSS = 1e9; // kg/s (approx)
const SOLAR_WIND_SPEED = 4e5; // m/s (400 km/s)
export function computeSolarWindPressure(distance_m: number): number {
  const r = Math.max(1e9, distance_m);
  return (SOLAR_MASS_LOSS * SOLAR_WIND_SPEED) / (4 * Math.PI * r * r);
}

export function computeSolarWindForce(distance_m: number, crossArea_m2: number): number {
  return computeSolarWindPressure(distance_m) * crossArea_m2;
}

// Anomaly gravity — Newton: a = GM/r² — 01 §2.3 perturbasi
const G = 6.67430e-11;
export function computeAnomalyAccel(mass_kg: number, distance_m: number): number {
  const r = Math.max(1e6, distance_m);
  return (G * mass_kg) / (r * r);
}

export function anomalyGravityVec(pos: Vec3, anomalyPos: Vec3, mass_kg: number): Vec3 {
  const dx = anomalyPos.x - pos.x, dy = anomalyPos.y - pos.y, dz = anomalyPos.z - pos.z;
  const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (r < 1e3) return { x: 0, y: 0, z: 0 };
  const a = computeAnomalyAccel(mass_kg, r);
  return { x: (dx / r) * a, y: (dy / r) * a, z: (dz / r) * a };
}
