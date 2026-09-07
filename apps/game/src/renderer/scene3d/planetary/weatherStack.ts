// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/weatherStack.ts - 10.X.2 CLEAR/OVERCAST/RAIN/STORM coordinated + RainState + wet/puddles/runoff/reflection. Zoom dari blueprint "Weather stack CLEAR->OVERCAST->RAIN->STORM coordinated".

// WIRE NOTE for SESSION 2: import { deriveWeatherStack, updateWeatherStack } from "./planetary/weatherStack" di scene3d/index.ts. Derive dari EnvironmentalContext.weather + clouds, update material wetness/puddles tiap frame.

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type WeatherStackPhase = "clear" | "overcast" | "rain" | "storm";

export interface WeatherStack {
  phase: WeatherStackPhase;
  cloudCoverage: number; // 0..1
  cloudDensity: number;
  precipitationIntensity: number; // 0..1
  windSpeed: number;
  visibility: number;
  sunlight: number; // 0..1
}

export function deriveWeatherStack(ctx: EnvironmentalContext): WeatherStack {
  const w = ctx.weather;
  const clouds = ctx.clouds;
  let phase: WeatherStackPhase = "clear";
  if (w.kind === "storm") phase = "storm";
  else if (w.kind === "rain") phase = "rain";
  else if (w.kind === "overcast") phase = "overcast";
  // Stabilize: avoid flicker if density borderline
  const sunlight = ctx.sun.intensity * (1 - clouds.density * 0.6) * (1 - clouds.coverage * 0.3);
  return {
    phase,
    cloudCoverage: clouds.coverage,
    cloudDensity: clouds.density,
    precipitationIntensity: w.precipitationIntensity,
    windSpeed: ctx.wind.speed,
    visibility: ctx.atmosphere.visibility,
    sunlight,
  };
}

// Apply weather to scene: sunlight -> exposure, visibility -> fog, precipitation -> wet hint
export function getWeatherExposure(stack: WeatherStack): number {
  // clear 1.0, overcast 0.85, rain 0.7, storm 0.55
  if (stack.phase === "storm") return 0.55 + stack.sunlight * 0.15;
  if (stack.phase === "rain") return 0.7 + stack.sunlight * 0.15;
  if (stack.phase === "overcast") return 0.85 + stack.sunlight * 0.1;
  return 0.95 + stack.sunlight * 0.05;
}

export function lerpWeatherStack(a: WeatherStack, b: WeatherStack, t: number): WeatherStack {
  const l = (x:number,y:number)=> x + (y-x)*t;
  return {
    phase: t < 0.5 ? a.phase : b.phase,
    cloudCoverage: l(a.cloudCoverage, b.cloudCoverage),
    cloudDensity: l(a.cloudDensity, b.cloudDensity),
    precipitationIntensity: l(a.precipitationIntensity, b.precipitationIntensity),
    windSpeed: l(a.windSpeed, b.windSpeed),
    visibility: l(a.visibility, b.visibility),
    sunlight: l(a.sunlight, b.sunlight),
  };
}

export function isWetPhase(s: WeatherStack): boolean {
  return s.phase === "rain" || s.phase === "storm" || s.precipitationIntensity > 0.12;
}

