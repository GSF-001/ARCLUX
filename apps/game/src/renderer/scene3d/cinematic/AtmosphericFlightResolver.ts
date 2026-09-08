// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// cinematic/AtmosphericFlightResolver.ts - 10.C Atmospheric Flight & Turbulence: Vessel+Wind+Density+Weather+Altitude+Velocity -> TurbulenceResolver -> visualPitch/Roll/Vibration/cameraShake. Zoom dari blueprint 10.C Atmospheric Flight & Turbulence.

// Resolved via the cinematic tick — see wire10X/wire10G wiring.

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export interface FlightTurbulence {
  pitch: number; // deg -2..2
  roll: number; // deg -2..2
  vibration: number; // 0..1
  cameraShake: number; // 0..1
  phase: "NORMAL" | "BUILDUP" | "ACTIVE" | "DECAY";
}

export function resolveAtmosphericFlight(
  envCtx: EnvironmentalContext,
  altitude: number, // m 0..8000
  velocity: number, // m/s
  prevPhase: FlightTurbulence["phase"] = "NORMAL",
  dt: number,
): FlightTurbulence {
  const wind = envCtx.wind;
  const density = envCtx.atmosphere.density; // 0..1 (SPACE 0 -> SURFACE 1)
  const weatherInt = envCtx.weather.precipitationIntensity;
  // Source: windVector + gust + turbulence + weatherIntensity
  const windContrib = wind.speed * 0.04 * (0.5 + wind.gustStrength * 0.5) * density;
  const turbContrib = wind.turbulence * 0.6 * density;
  const weatherContrib = weatherInt * 0.5 * density;
  const altitudeContrib = altitude < 1500 ? (1 - altitude / 1500) * 0.3 : 0; // low -> more
  const speedContrib = Math.min(0.3, velocity * 0.002);
  const intensity = Math.min(1, windContrib + turbContrib + weatherContrib + altitudeContrib + speedContrib);

  // Phase: NORMAL->BUILDUP->ACTIVE->DECAY->NORMAL, gak 0->MAX instan
  let phase = prevPhase;
  if (intensity > 0.55 && prevPhase === "NORMAL") phase = "BUILDUP";
  else if (intensity > 0.7 && prevPhase === "BUILDUP") phase = "ACTIVE";
  else if (intensity < 0.4 && prevPhase === "ACTIVE") phase = "DECAY";
  else if (intensity < 0.15 && prevPhase === "DECAY") phase = "NORMAL";
  else if (intensity < 0.1) phase = "NORMAL";

  // Visual pitch/roll bounded <=2deg, vibration 0..1
  const phaseMul = phase === "ACTIVE" ? 1 : phase === "BUILDUP" ? 0.6 : phase === "DECAY" ? 0.35 : 0.15;
  const pitch = Math.sin(Date.now() * 0.001 + wind.direction) * intensity * 1.2 * phaseMul;
  const roll = Math.cos(Date.now() * 0.0012 + wind.direction) * intensity * 0.9 * phaseMul;
  const vibration = intensity * 0.6 * phaseMul;
  const cameraShake = intensity * 0.4 * phaseMul;

  return {
    pitch: Math.max(-2, Math.min(2, pitch)),
    roll: Math.max(-2, Math.min(2, roll)),
    vibration: Math.min(1, vibration),
    cameraShake: Math.min(1, cameraShake),
    phase,
  };
}
