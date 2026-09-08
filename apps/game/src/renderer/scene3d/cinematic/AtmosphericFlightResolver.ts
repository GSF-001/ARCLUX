// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// cinematic/AtmosphericFlightResolver.ts - 10.C.3 flight turbulence.
// Couples vessel, wind, air density, weather, altitude, and velocity into
// presentation-only motion: visual pitch/roll (bounded), vibration, and
// camera shake. Turbulence builds and decays through phases instead of
// snapping, and output is smoothed toward targets so frames stay stable.
// Presentation only: never a physics force.

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";
import { MOTION_MAX_DEG } from "./CinematicContext";

export interface FlightTurbulence {
  pitch: number; // degrees, bounded to +/-MOTION_MAX_DEG
  roll: number; // degrees, bounded to +/-MOTION_MAX_DEG
  vibration: number; // 0..1
  cameraShake: number; // 0..1
  phase: "NORMAL" | "BUILDUP" | "ACTIVE" | "DECAY";
  intensity: number; // 0..1 raw source energy
}

const ENTER_BUILDUP = 0.55;
const ENTER_ACTIVE = 0.7;
const LEAVE_ACTIVE = 0.4;
const LEAVE_DECAY = 0.15;
const RESET_NORMAL = 0.1;

const PHASE_GAIN: Record<FlightTurbulence["phase"], number> = {
  ACTIVE: 1,
  BUILDUP: 0.6,
  DECAY: 0.35,
  NORMAL: 0.15,
};

function nextPhase(
  prev: FlightTurbulence["phase"],
  intensity: number,
): FlightTurbulence["phase"] {
  switch (prev) {
    case "NORMAL":
      return intensity > ENTER_BUILDUP ? "BUILDUP" : "NORMAL";
    case "BUILDUP":
      if (intensity > ENTER_ACTIVE) return "ACTIVE";
      if (intensity < LEAVE_DECAY) return "DECAY";
      return "BUILDUP";
    case "ACTIVE":
      return intensity < LEAVE_ACTIVE ? "DECAY" : "ACTIVE";
    case "DECAY":
      if (intensity > ENTER_ACTIVE) return "ACTIVE";
      if (intensity > ENTER_BUILDUP) return "BUILDUP";
      return intensity < LEAVE_DECAY ? "NORMAL" : "DECAY";
  }
}

/**
 * Resolve turbulence for one frame.
 * @param timeSec deterministic clock for oscillation (never Date.now)
 * @param prev previous output for rate smoothing (omit on first call)
 */
export function resolveAtmosphericFlight(
  envCtx: EnvironmentalContext,
  altitude: number,
  velocity: number,
  prevPhase: FlightTurbulence["phase"] = "NORMAL",
  dt: number,
  timeSec?: number,
  prev?: FlightTurbulence,
): FlightTurbulence {
  const now = timeSec ?? envCtx.worldTime / 1000 + envCtx.simulationTick * 0.1;
  const wind = envCtx.wind;
  const density = envCtx.atmosphere.density;
  const weatherInt = envCtx.weather.precipitationIntensity;

  const windContrib = wind.speed * 0.04 * (0.5 + wind.gustStrength * 0.5) * density;
  const turbContrib = wind.turbulence * 0.6 * density;
  const weatherContrib = weatherInt * 0.5 * density;
  const altitudeContrib = altitude < 1500 ? (1 - altitude / 1500) * 0.3 : 0;
  const speedContrib = Math.min(0.3, velocity * 0.002);
  const gustWave = 0.5 + 0.5 * Math.sin(now * 0.9 + wind.direction);
  const intensity = Math.min(
    1,
    (windContrib + turbContrib + weatherContrib + altitudeContrib + speedContrib) *
      (0.7 + 0.6 * gustWave * wind.gustStrength),
  );

  const phase = nextPhase(prevPhase, intensity);
  const gain = PHASE_GAIN[phase];
  const targetPitch = Math.sin(now * 1.1 + wind.direction) * intensity * 1.2 * gain;
  const targetRoll = Math.cos(now * 1.3 + wind.direction * 1.7) * intensity * 0.9 * gain;
  const targetVibration = Math.min(1, intensity * 0.6 * gain);
  const targetShake = Math.min(1, intensity * 0.4 * gain);

  // Rate smoothing: approach targets at ~6/s so motion never snaps.
  const k = prev ? Math.min(1, dt * 6) : 1;
  const smooth = (to: number, from: number | undefined): number =>
    from === undefined ? to : from + (to - from) * k;
  const pitch = Math.max(-MOTION_MAX_DEG, Math.min(MOTION_MAX_DEG, smooth(targetPitch, prev?.pitch)));
  const roll = Math.max(-MOTION_MAX_DEG, Math.min(MOTION_MAX_DEG, smooth(targetRoll, prev?.roll)));

  return {
    pitch,
    roll,
    vibration: smooth(targetVibration, prev?.vibration),
    cameraShake: smooth(targetShake, prev?.cameraShake),
    phase,
    intensity,
  };
}
