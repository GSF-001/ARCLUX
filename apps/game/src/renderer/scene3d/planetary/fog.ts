// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/fog.ts - 10.X.3 Fog temperature/humidity/weather -> height/distance/valley/entry haze + fog-sun god-ray feed. Zoom dari blueprint "Fog temperature/humidity/weather/altitude/terrain/wind/visibility/timeOfDay -> height/distance/valley/entry haze + god-ray feed".

// WIRE NOTE for SESSION 2: import { deriveFogState, createFogSystem, tickFog } from "./planetary/fog" di scene3d/index.ts. Create sekali, tick per frame dengan EnvironmentalContext + camera altitude.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export interface FogState {
  density: number; // 0..1
  height: number; // m 20..300
  distance: number; // m 800..8000
  valleyFactor: number; // 0..1
  entryHaze: number; // 0..1 (high altitude)
}

export function deriveFogState(ctx: EnvironmentalContext, cameraAltitude: number): FogState {
  const temp = 20; // placeholder, could be from ctx if added
  const humidity = ctx.weather.precipitationIntensity * 0.6 + 0.2;
  const weatherMul = ctx.weather.kind === "storm" ? 1 : ctx.weather.kind === "rain" ? 0.7 : ctx.weather.kind === "overcast" ? 0.4 : 0.15;
  const altitudeFactor = Math.max(0, 1 - cameraAltitude / 2500); // low -> more fog
  const valleyFactor = ctx.terrain.height < 50 && ctx.terrain.slope < 0.15 ? 0.8 : 0.2;
  const density = Math.min(1, humidity * 0.7 + weatherMul * 0.5 + (1 - ctx.atmosphere.visibility / 10000) * 0.4 + altitudeFactor * 0.2);
  const height = 20 + density * 280;
  const distance = 800 + (1 - density) * 7200;
  const entryHaze = cameraAltitude > 800 ? Math.min(1, (cameraAltitude - 800) / 2000) * ctx.atmosphere.haze : 0;
  return { density: density * (0.5 + valleyFactor * 0.5), height, distance, valleyFactor, entryHaze };
}

export interface FogSystem {
  fog: THREE.FogExp2;
  lastState: FogState | null;
}

export function createFogSystem(scene: THREE.Scene, initialColor = 0x8aa0b8): FogSystem {
  const fog = new THREE.FogExp2(initialColor, 0.00012);
  scene.fog = fog;
  return { fog, lastState: null };
}

export function tickFog(sys: FogSystem, state: FogState, sunColor: THREE.Color): void {
  sys.fog.density = 0.00006 + state.density * 0.00032 + state.entryHaze * 0.00018;
  // Color lerp: fog density high -> grey, valley -> warm slightly
  const base = new THREE.Color(0x8aa0b8);
  base.lerp(sunColor, state.valleyFactor * 0.25);
  sys.fog.color.copy(base);
  sys.lastState = state;
  // God-ray feed hint: SESSION 2 bisa baca state.density untuk godRays fogDensity
}

export function getFogVisibility(state: FogState): number {
  return state.distance * (1 - state.density * 0.5);
}

export function fogDensityForGodRay(state: FogState): number {
  return state.density * 0.7 + state.valleyFactor * 0.15 + state.entryHaze * 0.2;
}

