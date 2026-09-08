// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";
import type { CinematicContext } from "./CinematicContext";
import type { FlightTurbulence } from "./AtmosphericFlightResolver";

export interface CockpitState {
  windshieldWet: number;
  dropletOpacity: number;
  flashIntensity: number;
  heatVignette: number;
  cloudDim: number;
  hudShake: { x: number; y: number };
  exposureOffset: number;
}

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

export function deriveCockpitState(
  env: EnvironmentalContext,
  cinematic: CinematicContext | null,
  turbulence: FlightTurbulence | null,
  distanceToLightning: number,
  dt: number,
): CockpitState {
  const rainInt = env.weather.precipitationIntensity;
  const cloudDense = env.clouds.density;
  const haze = env.atmosphere.haze;
  const scattering = env.atmosphere.scattering;
  const flashBase = cinematic?.eventType === "LIGHTNING" && cinematic.phase === "PEAK" ? 1 - Math.min(1, distanceToLightning / 4200) : 0;
  const flashIntensity = clamp01(flashBase * (0.72 + rainInt * 0.28));
  const windshieldWet = clamp01(rainInt * 0.82 + (env.precipitation.accumulation ?? 0) * 0.12);
  const dropletOpacity = clamp01(windshieldWet * (0.55 + rainInt * 0.32) + (flashIntensity > 0.5 ? 0.08 : 0));
  const heat = Math.max(0, (env.atmosphere.density - 0.62) * 1.8) * (cinematic?.eventType === "ATMOSPHERIC_ENTRY" ? 1.4 : 0.22);
  const heatVignette = clamp01(heat * 0.52 + (env.terrain.height < 20 ? 0 : 0));
  const cloudDim = clamp01(cloudDense * 0.42 + haze * 0.22 + (env.clouds.coverage > 0.6 ? 0.12 : 0));
  const turbShake = turbulence ? turbulence.cameraShake * 0.7 : 0;
  const hudShake = {
    x: Math.sin(Date.now() * 0.009) * turbShake * 1.8 + flashIntensity * 0.6,
    y: Math.cos(Date.now() * 0.011) * turbShake * 1.2 + heatVignette * 0.4,
  };
  const exposureOffset = clamp01(flashIntensity * 0.28 + heatVignette * 0.12 + (1 - scattering) * 0.06);
  void dt;
  return { windshieldWet, dropletOpacity, flashIntensity, heatVignette, cloudDim, hudShake, exposureOffset };
}

export function tickCockpit(prev: CockpitState, next: CockpitState, dt: number): CockpitState {
  const a = 1 - Math.exp(-dt * 4.2);
  const flashA = 1 - Math.exp(-dt * 9.5);
  return {
    windshieldWet: lerp(prev.windshieldWet, next.windshieldWet, a),
    dropletOpacity: lerp(prev.dropletOpacity, next.dropletOpacity, a),
    flashIntensity: lerp(prev.flashIntensity, next.flashIntensity, flashA),
    heatVignette: lerp(prev.heatVignette, next.heatVignette, a),
    cloudDim: lerp(prev.cloudDim, next.cloudDim, a),
    hudShake: { x: lerp(prev.hudShake.x, next.hudShake.x, a), y: lerp(prev.hudShake.y, next.hudShake.y, a) },
    exposureOffset: lerp(prev.exposureOffset, next.exposureOffset, a),
  };
}

export function applyCockpitToOverlay(overlay: { opacity: number; flash: number }, state: CockpitState): void {
  overlay.opacity = state.dropletOpacity * 0.82 + state.cloudDim * 0.12;
  overlay.flash = state.flashIntensity;
}
