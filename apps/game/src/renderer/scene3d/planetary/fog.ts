// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/fog.ts - 10.X.3 fog resolver.
// Temperature, humidity, weather, altitude, terrain, wind, visibility, and
// time of day collapse into one fog state: density, layer height, view
// distance, valley pooling, and high-altitude entry haze. Also feeds the
// god-ray resolver. Visual-only: reads EnvironmentalContext.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

const FOG_BASE = 0x8aa0b8;
const BASE_DENSITY = 0.00006;
const DENSITY_SCALE = 0.00032;
const HAZE_SCALE = 0.00018;

export interface FogState {
  density: number; // 0..1
  height: number; // layer height in meters, 20..300
  distance: number; // view distance in meters, 800..8000
  valleyFactor: number; // 0..1 fog pooling in low flat ground
  entryHaze: number; // 0..1 high-altitude haze
}

/** Approximate surface temperature from sun elevation and altitude. */
export function temperatureForContext(ctx: EnvironmentalContext, cameraAltitude: number): number {
  const solar = Math.max(0, Math.sin(Math.max(-0.2, ctx.sun.elevation)));
  const dayWarmth = ctx.timeOfDay === "night" ? -8 : solar * 14;
  return 20 + dayWarmth - cameraAltitude * 0.0065 - ctx.clouds.coverage * 4;
}

function humidityForContext(ctx: EnvironmentalContext): number {
  const precip = ctx.weather.precipitationIntensity * 0.65;
  const murk = (1 - ctx.atmosphere.visibility / 10000) * 0.3;
  const night = ctx.timeOfDay === "night" ? 0.1 : 0;
  return Math.min(1, 0.2 + precip + murk + night);
}

function weatherMultiplier(kind: EnvironmentalContext["weather"]["kind"]): number {
  if (kind === "storm") return 1;
  if (kind === "rain") return 0.7;
  if (kind === "overcast") return 0.4;
  return 0.15;
}

export function deriveFogState(ctx: EnvironmentalContext, cameraAltitude: number): FogState {
  const temp = temperatureForContext(ctx, cameraAltitude);
  const humidity = humidityForContext(ctx);
  const weatherMul = weatherMultiplier(ctx.weather.kind);
  const altitudeFactor = Math.max(0, 1 - cameraAltitude / 2500);
  // Smooth valley pooling: low and flat ground holds fog, slopes drain it.
  const lowFactor = Math.max(0, 1 - Math.max(0, ctx.terrain.height) / 120);
  const flatFactor = Math.max(0, 1 - ctx.terrain.slope / 0.3);
  const valleyFactor = Math.min(1, lowFactor * 0.6 + flatFactor * 0.4);
  // Cold air holds fog longer.
  const coldMul = temp < 8 ? 1.25 : temp < 14 ? 1.1 : 1;
  const density = Math.min(
    1,
    (humidity * 0.7 + weatherMul * 0.5 + (1 - ctx.atmosphere.visibility / 10000) * 0.4 + altitudeFactor * 0.2) * coldMul,
  );
  const height = 20 + density * 280;
  const distance = 800 + (1 - density) * 7200;
  const entryHaze =
    cameraAltitude > 800 ? Math.min(1, (cameraAltitude - 800) / 2000) * ctx.atmosphere.haze : 0;
  return { density: density * (0.5 + valleyFactor * 0.5), height, distance, valleyFactor, entryHaze };
}

export interface FogSystem {
  fog: THREE.FogExp2;
  lastState: FogState | null;
}

const _fogBase = new THREE.Color();

export function createFogSystem(scene: THREE.Scene, initialColor = FOG_BASE): FogSystem {
  const fog = new THREE.FogExp2(initialColor, 0.00012);
  scene.fog = fog;
  return { fog, lastState: null };
}

export function tickFog(sys: FogSystem, state: FogState, sunColor: THREE.Color): void {
  sys.fog.density = BASE_DENSITY + state.density * DENSITY_SCALE + state.entryHaze * HAZE_SCALE;
  _fogBase.set(FOG_BASE);
  _fogBase.lerp(sunColor, state.valleyFactor * 0.25);
  sys.fog.color.copy(_fogBase);
  sys.lastState = state;
}

/** View distance after fog attenuation. */
export function getFogVisibility(state: FogState): number {
  return state.distance * (1 - state.density * 0.5);
}

/** Fog contribution consumed by the god-ray resolver. */
export function fogDensityForGodRay(state: FogState): number {
  return state.density * 0.7 + state.valleyFactor * 0.15 + state.entryHaze * 0.2;
}
