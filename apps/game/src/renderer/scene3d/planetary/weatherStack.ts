// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/weatherStack.ts - 10.X.2 coordinated weather stack.
// Collapses authority weather, cloud, sun, and wind state into one phase
// (clear / overcast / rain / storm) plus the scalars downstream resolvers
// need: sunlight, visibility, precipitation. Phase transitions use hysteresis
// so borderline density does not flicker between frames.
// Visual-only: derives from EnvironmentalContext, never writes authority state.

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type WeatherStackPhase = "clear" | "overcast" | "rain" | "storm";

export interface WeatherStack {
  phase: WeatherStackPhase;
  cloudCoverage: number; // 0..1
  cloudDensity: number;
  precipitationIntensity: number; // 0..1
  windSpeed: number; // m/s
  visibility: number; // m
  sunlight: number; // 0..1 after cloud attenuation
}

// Hysteresis bands: entering rain/storm needs more precipitation than leaving.
const RAIN_ENTER = 0.12;
const RAIN_EXIT = 0.05;
const STORM_DENSITY_ENTER = 0.75;
const STORM_DENSITY_EXIT = 0.6;

function targetPhase(ctx: EnvironmentalContext, prev: WeatherStackPhase | undefined): WeatherStackPhase {
  const w = ctx.weather;
  if (w.kind === "storm") {
    if (prev === "storm" && ctx.clouds.density > STORM_DENSITY_EXIT) return "storm";
    if (prev !== "storm" && ctx.clouds.density < STORM_DENSITY_ENTER) return "rain";
    return "storm";
  }
  if (w.kind === "rain") {
    if (prev === "clear" || prev === "overcast") {
      return w.precipitationIntensity > RAIN_ENTER ? "rain" : prev;
    }
    if (w.precipitationIntensity < RAIN_EXIT) return "overcast";
    return "rain";
  }
  if (w.kind === "overcast") return "overcast";
  if (
    (prev === "rain" || prev === "storm") &&
    w.precipitationIntensity > RAIN_EXIT
  ) {
    return prev;
  }
  return "clear";
}

/**
 * Derive the coordinated stack. Pass the previous phase to stabilize
 * transitions; omit it for a stateless read.
 */
export function deriveWeatherStack(ctx: EnvironmentalContext, prevPhase?: WeatherStackPhase): WeatherStack {
  const clouds = ctx.clouds;
  const phase = targetPhase(ctx, prevPhase);
  const sunlight = ctx.sun.intensity * (1 - clouds.density * 0.6) * (1 - clouds.coverage * 0.3);
  return {
    phase,
    cloudCoverage: clouds.coverage,
    cloudDensity: clouds.density,
    precipitationIntensity: ctx.weather.precipitationIntensity,
    windSpeed: ctx.wind.speed,
    visibility: ctx.atmosphere.visibility,
    sunlight: Math.max(0, sunlight),
  };
}

/** Tone-mapping exposure for the current phase. */
export function getWeatherExposure(stack: WeatherStack): number {
  if (stack.phase === "storm") return 0.55 + stack.sunlight * 0.15;
  if (stack.phase === "rain") return 0.7 + stack.sunlight * 0.15;
  if (stack.phase === "overcast") return 0.85 + stack.sunlight * 0.1;
  return 0.95 + stack.sunlight * 0.05;
}

/** Interpolate two stacks for smooth cross-fades between context updates. */
export function lerpWeatherStack(a: WeatherStack, b: WeatherStack, t: number): WeatherStack {
  const clamped = Math.min(1, Math.max(0, t));
  const l = (x: number, y: number): number => x + (y - x) * clamped;
  return {
    phase: clamped < 0.5 ? a.phase : b.phase,
    cloudCoverage: l(a.cloudCoverage, b.cloudCoverage),
    cloudDensity: l(a.cloudDensity, b.cloudDensity),
    precipitationIntensity: l(a.precipitationIntensity, b.precipitationIntensity),
    windSpeed: l(a.windSpeed, b.windSpeed),
    visibility: l(a.visibility, b.visibility),
    sunlight: l(a.sunlight, b.sunlight),
  };
}

export function isWetPhase(s: WeatherStack): boolean {
  return s.phase === "rain" || s.phase === "storm" || s.precipitationIntensity > RAIN_ENTER;
}
