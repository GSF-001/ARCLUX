// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/environment.ts — 10.1 Substrate Contracts PERFECT AAA — single source EnvironmentalContext + WindState deterministic mulberry32, 24h sun, per-chunk weather, 9 terrain biomes, g 3.71..9.81, budget FAR->CINEMATIC. Blueprint 10 §10.X.3-4 + §14 zoom 10x.

import type { Vec3 } from "../types";

// WindState — satu angin dilihat awan+hujan+kabut+daun+debu bareng (10.X §4)
export interface WindState {
  direction: number; // rad 0=+X
  speed: number; // m/s 2..14
  gustStrength: number; // 0..1
  turbulence: number; // 0..1
  verticalComponent: number; // m/s -0.8..0.8
  altitudeGradient: number; // m/s per m 0.002..0.008
  localVariation: number; // 0..1 Valley A vs B
  shear: number; // 0..1 vertical shear
  coherence: number; // 0..1 gust coherence 60 ticks
}

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export interface SunState {
  direction: Vec3; // normalized
  elevation: number; // rad -0.3..1.3
  azimuth: number; // rad 0..2pi
  intensity: number; // 0..1
  color: string; // hex 5800K->warm
  atmosphericTransmission: number; // 0..1
  shadowLength: number; // 1..3 low sun stretch
  limbDarkening: number; // 0..1
}

export interface AtmosphereState { density: number; pressure: number; visibility: number; haze: number; scattering: number; turbidity: number; }
export interface WeatherState { kind: "clear" | "overcast" | "rain" | "storm"; cloudCoverage: number; cloudDensity: number; cloudThickness: number; precipitationIntensity: number; stormCell: number; frontSpeed: number; }
export interface CloudState { coverage: number; density: number; thickness: number; altitude: number; gaps: number; edgeSoftness: number; shadowOpacity: number; }
export interface PrecipitationState { intensity: number; type: "rain" | "snow" | "none"; dropletDensity: number; slant: number; accumulation: number; }
export interface TerrainState { height: number; slope: number; biome: "plains" | "mountain" | "desert" | "forest" | "snow" | "wetland" | "volcanic" | "canyon" | "tundra"; wetness: number; snow: number; erosion: number; fertility: number; }
export interface OceanState { waveAmplitude: number; waveFrequency: number; foam: number; depth: number; roughness: number; salinity: number; current: number; }
export interface LocalSurfaceState { material: "rock" | "sand" | "grass" | "snow" | "water" | "metal" | "clay" | "ash"; wetness: number; puddles: number; dust: number; roughness: number; }

export interface EnvironmentalContext {
  planetId: string; planetSeed: number; chunkKey: string; simulationTick: number; worldTime: number; timeOfDay: TimeOfDay;
  sun: SunState; moonState: { phase: number; illumination: number; rise: number };
  atmosphere: AtmosphereState; weather: WeatherState; wind: WindState; clouds: CloudState; precipitation: PrecipitationState;
  terrain: TerrainState; ocean: OceanState; localSurface: LocalSurfaceState;
  gravity: number; // 3.71..9.81
  vesselState?: { position: Vec3; velocity: Vec3; altitude: number; health: number };
  facilityState?: { id: string; health: number; emissive: number };
  localEffectBudget: "FAR" | "MEDIUM" | "NEAR" | "CINEMATIC";
}

// Deterministic
function mulberry32(seed: number): () => number { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

export function deriveWindState(planetSeed: number, tick: number, chunkKey: string): WindState {
  const rnd = mulberry32(hashStr(`${planetSeed}:${chunkKey}:${Math.floor(tick / 60)}`));
  const rnd2 = mulberry32(hashStr(`wind2:${planetSeed}:${chunkKey}:${Math.floor(tick / 180)}`));
  return { direction: rnd() * Math.PI * 2, speed: 2 + rnd() * 12, gustStrength: rnd() * 0.75, turbulence: 0.25 + rnd() * 0.65, verticalComponent: (rnd() - 0.5) * 1.6, altitudeGradient: 0.0015 + rnd() * 0.0065, localVariation: rnd(), shear: rnd2() * 0.45, coherence: 0.55 + rnd() * 0.4 };
}

export function deriveSunState(planetSeed: number, worldTime: number): SunState {
  const dayMs = 24 * 60 * 60 * 1000;
  const t = (worldTime % dayMs) / dayMs;
  const elevation = Math.sin((t - 0.25) * Math.PI * 2) * 1.15;
  const intensity = Math.max(0, Math.sin((t - 0.06) * Math.PI * 2));
  const isNight = intensity < 0.05;
  const azimuth = t * Math.PI * 2;
  return { direction: { x: Math.cos(azimuth) * Math.cos(elevation), y: Math.sin(elevation), z: Math.sin(azimuth) * Math.cos(elevation) }, elevation: Math.max(-0.32, elevation), azimuth, intensity: isNight ? 0 : intensity, color: t < 0.18 || t > 0.82 ? "#ff7a3a" : t < 0.27 || t > 0.73 ? "#ffbc6b" : t < 0.32 || t > 0.68 ? "#ffd9a0" : "#fff8e8", atmosphericTransmission: isNight ? 0.18 : 0.55 + intensity * 0.42, shadowLength: isNight ? 3 : 1 + (1 - intensity) * 1.8, limbDarkening: isNight ? 0 : 0.15 + intensity * 0.25 };
}

export function deriveWeatherState(planetSeed: number, tick: number, chunkKey: string): WeatherState {
  const rnd = mulberry32(hashStr(`weather:${planetSeed}:${chunkKey}:${Math.floor(tick / 600)}`));
  const r = rnd(); let kind: WeatherState["kind"] = "clear"; if (r > 0.86) kind = "storm"; else if (r > 0.64) kind = "rain"; else if (r > 0.38) kind = "overcast";
  return { kind, cloudCoverage: kind === "clear" ? rnd() * 0.28 : kind === "overcast" ? 0.48 + rnd() * 0.32 : 0.72 + rnd() * 0.28, cloudDensity: kind === "storm" ? 0.82 + rnd() * 0.18 : rnd() * 0.72, cloudThickness: kind === "storm" ? 850 + rnd() * 750 : 320 + rnd() * 520, precipitationIntensity: kind === "rain" ? 0.38 + rnd() * 0.42 : kind === "storm" ? 0.72 + rnd() * 0.28 : 0, stormCell: rnd(), frontSpeed: 3 + rnd() * 9 };
}

export function deriveTerrainState(height: number, slope: number, wetness: number): TerrainState {
  let biome: TerrainState["biome"] = "plains";
  if (height > 420) biome = "mountain"; else if (height < -8) biome = "wetland"; else if (wetness < 0.18 && slope < 0.15) biome = "desert"; else if (slope > 0.45) biome = "canyon"; else if (height > 280 && wetness < 0.3) biome = "tundra";
  return { height, slope: Math.min(1, slope), biome, wetness, snow: height > 300 ? Math.min(1, (height - 300) / 250) : 0, erosion: Math.min(1, slope * 0.7 + Math.abs(height) * 0.00012), fertility: wetness * (1 - slope * 0.6) };
}

export function createEnvironmentalContext(opts: { planetId: string; planetSeed: number; chunkKey: string; simulationTick: number; worldTime: number; terrainHeight?: number; oceanDepth?: number; gravity?: number }): EnvironmentalContext {
  const sun = deriveSunState(opts.planetSeed, opts.worldTime);
  const weather = deriveWeatherState(opts.planetSeed, opts.simulationTick, opts.chunkKey);
  const wind = deriveWindState(opts.planetSeed, opts.simulationTick, opts.chunkKey);
  const hour = (opts.worldTime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000);
  const timeOfDay: TimeOfDay = hour < 5 || hour > 19 ? "night" : hour < 7 ? "dawn" : hour > 17 ? "dusk" : "day";
  const height = opts.terrainHeight ?? 0; const slope = Math.min(1, Math.abs(height) / 750);
  const terrain = deriveTerrainState(height, slope, weather.precipitationIntensity * 0.62);
  const gravity = opts.gravity ?? 9.81;
  return { planetId: opts.planetId, planetSeed: opts.planetSeed, chunkKey: opts.chunkKey, simulationTick: opts.simulationTick, worldTime: opts.worldTime, timeOfDay, sun, moonState: { phase: (opts.simulationTick * 0.0017) % 1, illumination: 0.35 + 0.65 * Math.sin(opts.simulationTick * 0.0017), rise: (opts.simulationTick * 0.0008) % 1 }, atmosphere: { density: 0.55 + weather.cloudDensity * 0.18, pressure: 980 + weather.cloudThickness * 0.04, visibility: weather.kind === "storm" ? 1800 : weather.kind === "rain" ? 4200 : 11000, haze: weather.cloudDensity * 0.38, scattering: sun.atmosphericTransmission * 0.62, turbidity: 2.2 + weather.cloudDensity * 1.8 }, weather, wind, clouds: { coverage: weather.cloudCoverage, density: weather.cloudDensity, thickness: weather.cloudThickness, altitude: 1150 + wind.altitudeGradient * 50000, gaps: 1 - weather.cloudCoverage, edgeSoftness: 0.35 + wind.turbulence * 0.35, shadowOpacity: weather.cloudDensity * 0.32 }, precipitation: { intensity: weather.precipitationIntensity, type: weather.kind === "storm" || weather.kind === "rain" ? "rain" : "none", dropletDensity: weather.precipitationIntensity * 860, slant: wind.direction, accumulation: weather.precipitationIntensity * 0.72 }, terrain, ocean: { waveAmplitude: 0.9 + wind.speed * 0.32 + weather.precipitationIntensity * 0.5, waveFrequency: 0.18 + wind.turbulence * 0.08, foam: wind.speed > 6.5 ? 0.38 + weather.precipitationIntensity * 0.22 : weather.precipitationIntensity * 0.15, depth: opts.oceanDepth ?? 0, roughness: 0.38 + wind.turbulence * 0.32, salinity: 35, current: wind.speed * 0.08 }, localSurface: { material: height < -2 ? "water" : height > 300 ? "snow" : terrain.biome === "desert" ? "sand" : "rock", wetness: weather.precipitationIntensity, puddles: weather.precipitationIntensity * 0.52, dust: 1 - weather.precipitationIntensity * 0.85, roughness: 0.6 + slope * 0.3 }, gravity, localEffectBudget: "MEDIUM" };
}

// WIRE NOTE: SESSION 2 wire di scene3d/index.ts: import { createEnvironmentalContext } from "planetary/environment" per 60 ticks, inject ke sun/cloudShadows/godRays/weather/rain/fog dll.

