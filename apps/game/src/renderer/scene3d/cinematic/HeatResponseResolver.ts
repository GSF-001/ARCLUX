// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// cinematic/HeatResponseResolver.ts - 10.C.4 entry heating presentation.
// Converts entry velocity, air density, and altitude into a heat response:
// glow strength, shell color ramp, and a small exposure lift. State flows
// COLD -> HEATING -> PEAK -> COOLING -> NORMAL so heating never pops.
// Presentation only: damage stays authoritative in the sim.

export type HeatPhase = "COLD" | "HEATING" | "PEAK" | "COOLING" | "NORMAL";

export interface HeatResponse {
  heat: number; // 0..1 shell glow
  phase: HeatPhase;
  glowColor: number; // hex ramp: amber -> orange -> white
  exposureLift: number; // additive stops, 0..0.2
}

const HEAT_ENTER = 0.25;
const HEAT_PEAK = 0.65;
const HEAT_RELEASE = 0.35;
const HEAT_REST = 0.08;

function nextHeatPhase(prev: HeatPhase, load: number): HeatPhase {
  switch (prev) {
    case "COLD":
      return load > HEAT_ENTER ? "HEATING" : "COLD";
    case "NORMAL":
      return load > HEAT_ENTER ? "HEATING" : "NORMAL";
    case "HEATING":
      if (load > HEAT_PEAK) return "PEAK";
      if (load < HEAT_REST) return "COOLING";
      return "HEATING";
    case "PEAK":
      return load < HEAT_RELEASE ? "COOLING" : "PEAK";
    case "COOLING":
      if (load > HEAT_PEAK) return "PEAK";
      return load < HEAT_REST ? "NORMAL" : "COOLING";
  }
}

/**
 * Resolve entry heat for one frame. Load couples entry speed against the
 * local air: fast and low is hot, slow or thin air is cold.
 */
export function resolveHeatResponse(
  velocity: number,
  density: number,
  altitude: number,
  prevPhase: HeatPhase = "COLD",
  prevHeat = 0,
  dt: number,
): HeatResponse {
  const speedFactor = Math.min(1, velocity / 120);
  const airFactor = Math.min(1, density * (altitude < 3000 ? 1 : 0.4));
  const load = Math.min(1, speedFactor * 0.7 + airFactor * 0.5);
  const phase = nextHeatPhase(prevPhase, load);

  const target =
    phase === "PEAK" ? Math.min(1, 0.75 + load * 0.25)
    : phase === "HEATING" ? 0.3 + load * 0.45
    : phase === "COOLING" ? load * 0.35
    : 0;
  const k = Math.min(1, dt * (phase === "COOLING" ? 1.5 : 4));
  const heat = prevHeat + (target - prevHeat) * k;
  const glowColor = heat > 0.75 ? 0xffffff : heat > 0.4 ? 0xff8a3a : 0xff5a2a;
  return { heat, phase, glowColor, exposureLift: Math.min(0.2, heat * 0.2) };
}
