// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// planetary/environment.ts - 10.1 Substrate Contracts (PLAN - FINAL, zoomed).
// Blueprint 10 §10.X.3-4 kasar: "EnvironmentalContext + WindState". File ini zoom
// sampai butiran kontrak biar code 1:1 gampang - tiap field ada tipe, satuan,
// sumber, dan resolver yang bacanya. Gak ada simulasi baru, cuma kontrak
// yang dibaca semua sistem (terrain, ocean, weather, vessel, facility).

import type { Vec3 } from "../types";

// ---------------------------------------------------------------------------
// WindState - satu angin dilihat semua sistem (10.X §4)
// ---------------------------------------------------------------------------

/**
 * Satu angin global per chunk - awan, hujan, kabut, debu, daun gerak bareng.
 * Derived deterministik dari planetSeed + tick + chunkKey (mulberry32),
 * bukan wind simulator kedua.
 */
export interface WindState {
  /** Arah horizontal (radian, 0 = +X, CCW). */
  direction: number;
  /** Kecepatan mean (m/s). */
  speed: number;
  /** Gust strength (0..1) - daun/branch beda fase. */
  gustStrength: number;
  /** Turbulence (0..1) - small->large scale beda respons. */
  turbulence: number;
  /** Komponen vertikal (m/s) - updraft/downdraft. */
  verticalComponent: number;
  /** Gradien dengan altitude (m/s per m) - low flight beda dari high. */
  altitudeGradient: number;
  /** Variasi lokal (0..1) - Valley A vs Valley B gak sinkron. */
  localVariation: number;
}

// ---------------------------------------------------------------------------
// Sub-states - tiap field ada satuan & sumber authoritative
// ---------------------------------------------------------------------------

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export interface SunState {
  direction: Vec3; // normalized
  elevation: number; // rad, 0 = horizon, π/2 = zenith
  intensity: number; // 0..1 (1 = noon clear, 0 = night)
  color: string; // hex, temp 5800K -> warm dusk
  atmosphericTransmission: number; // 0..1 (haze)
}

export interface AtmosphereState {
  density: number; // 0..1 (SPACE 0 -> SURFACE 1)
  pressure: number; // hPa
  visibility: number; // m
  haze: number; // 0..1
}

export interface WeatherState {
  kind: "clear" | "overcast" | "rain" | "storm";
  cloudCoverage: number; // 0..1
  cloudDensity: number; // 0..1
  cloudThickness: number; // m
  precipitationIntensity: number; // 0..1
}

export interface CloudState {
  coverage: number;
  density: number;
  thickness: number;
  altitude: number; // m
  gaps: number; // 0..1 (god-ray source)
}

export interface PrecipitationState {
  intensity: number; // 0..1
  type: "rain" | "snow" | "none";
  dropletDensity: number; // per m³
}

export interface TerrainState {
  height: number; // m (heightmap)
  slope: number; // 0..1 (0.4 -> military)
  biome: "plains" | "mountain" | "desert" | "forest" | "snow" | "wetland";
  wetness: number; // 0..1 (WET->DRYING)
  snow: number; // 0..1
}

export interface OceanState {
  waveAmplitude: number; // m
  waveFrequency: number; // Hz
  foam: number; // 0..1
  depth: number; // m
  roughness: number; // 0..1
}

export interface LocalSurfaceState {
  material: "rock" | "sand" | "grass" | "snow" | "water" | "metal";
  wetness: number; // 0..1
  puddles: number; // 0..1
  dust: number; // 0..1
}

// ---------------------------------------------------------------------------
// EnvironmentalContext - SATU sumber yang dibaca semua resolver
// ---------------------------------------------------------------------------

export interface EnvironmentalContext {
  // Identitas
  planetId: string;
  planetSeed: number; // mulberry32(planetId)
  chunkKey: string; // planetId:chunkX:chunkZ
  simulationTick: number;
  worldTime: number; // ms since epoch
  timeOfDay: TimeOfDay;

  // Sun & sky
  sun: SunState;
  moonState: { phase: number; illumination: number }; // 0..1

  // Atmosphere & weather
  atmosphere: AtmosphereState;
  weather: WeatherState;
  wind: WindState;
  clouds: CloudState;
  precipitation: PrecipitationState;

  // Surface
  terrain: TerrainState;
  ocean: OceanState;
  localSurface: LocalSurfaceState;

  // Vessel & facility (authoritative, dibaca doang)
  vesselState?: { position: Vec3; velocity: Vec3; altitude: number; health: number };
  facilityState?: { id: string; health: number; emissive: number };

  // Budget (10.X §52-53)
  localEffectBudget: "FAR" | "MEDIUM" | "NEAR" | "CINEMATIC";
}

// ---------------------------------------------------------------------------
// Deterministic helpers - zoom dari blueprint kasar ke presisi
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Derive WindState deterministik dari planetSeed + tick + chunkKey. */
export function deriveWindState(planetSeed: number, tick: number, chunkKey: string): WindState {
  const rnd = mulberry32(hashStr(`${planetSeed}:${chunkKey}:${Math.floor(tick / 60)}`));
  return {
    direction: rnd() * Math.PI * 2,
    speed: 2 + rnd() * 8, // 2..10 m/s
    gustStrength: rnd() * 0.6,
    turbulence: 0.3 + rnd() * 0.5,
    verticalComponent: (rnd() - 0.5) * 1.2,
    altitudeGradient: 0.002 + rnd() * 0.004,
    localVariation: rnd(),
  };
}

/** Derive SunState dari worldTime + planetSeed (24h cycle, no magic). */
export function deriveSunState(planetSeed: number, worldTime: number): SunState {
  const dayMs = 24 * 60 * 60 * 1000;
  const t = (worldTime % dayMs) / dayMs; // 0..1
  const elevation = Math.sin((t - 0.25) * Math.PI * 2) * 1.1; // -1.1..1.1 rad
  const intensity = Math.max(0, Math.sin((t - 0.06) * Math.PI * 2));
  const isNight = intensity < 0.05;
  return {
    direction: { x: Math.cos(t * Math.PI * 2), y: Math.sin(t * Math.PI * 2), z: 0.2 },
    elevation: Math.max(-0.3, elevation),
    intensity: isNight ? 0 : intensity,
    color: t < 0.2 || t > 0.8 ? "#ff9a5c" : t < 0.3 || t > 0.7 ? "#ffd9a0" : "#ffffff",
    atmosphericTransmission: isNight ? 0.2 : 0.6 + intensity * 0.4,
  };
}

/** Derive WeatherState per chunk (bukan global 1 planet). */
export function deriveWeatherState(planetSeed: number, tick: number, chunkKey: string): WeatherState {
  const rnd = mulberry32(hashStr(`weather:${planetSeed}:${chunkKey}:${Math.floor(tick / 600)}`));
  const r = rnd();
  let kind: WeatherState["kind"] = "clear";
  if (r > 0.85) kind = "storm";
  else if (r > 0.65) kind = "rain";
  else if (r > 0.4) kind = "overcast";
  return {
    kind,
    cloudCoverage: kind === "clear" ? rnd() * 0.3 : kind === "overcast" ? 0.5 + rnd() * 0.3 : 0.7 + rnd() * 0.3,
    cloudDensity: kind === "storm" ? 0.8 + rnd() * 0.2 : rnd() * 0.7,
    cloudThickness: kind === "storm" ? 800 + rnd() * 700 : 300 + rnd() * 500,
    precipitationIntensity: kind === "rain" ? 0.4 + rnd() * 0.4 : kind === "storm" ? 0.7 + rnd() * 0.3 : 0,
  };
}

/** Satu fungsi buat dapet full EnvironmentalContext dari minimal input. */
export function createEnvironmentalContext(opts: {
  planetId: string;
  planetSeed: number;
  chunkKey: string;
  simulationTick: number;
  worldTime: number;
  terrainHeight?: number;
  oceanDepth?: number;
}): EnvironmentalContext {
  const sun = deriveSunState(opts.planetSeed, opts.worldTime);
  const weather = deriveWeatherState(opts.planetSeed, opts.simulationTick, opts.chunkKey);
  const wind = deriveWindState(opts.planetSeed, opts.simulationTick, opts.chunkKey);
  const hour = (opts.worldTime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000);
  const timeOfDay: TimeOfDay = hour < 5 || hour > 19 ? "night" : hour < 7 ? "dawn" : hour > 17 ? "dusk" : "day";
  const height = opts.terrainHeight ?? 0;
  const slope = Math.min(1, Math.abs(height) / 800);
  return {
    planetId: opts.planetId,
    planetSeed: opts.planetSeed,
    chunkKey: opts.chunkKey,
    simulationTick: opts.simulationTick,
    worldTime: opts.worldTime,
    timeOfDay,
    sun,
    moonState: { phase: (opts.simulationTick * 0.001) % 1, illumination: 0.5 + 0.5 * Math.sin(opts.simulationTick * 0.001) },
    atmosphere: { density: 0.6, pressure: 1013, visibility: weather.kind === "storm" ? 2000 : 10000, haze: weather.cloudDensity * 0.4 },
    weather,
    wind,
    clouds: { coverage: weather.cloudCoverage, density: weather.cloudDensity, thickness: weather.cloudThickness, altitude: 1200, gaps: 1 - weather.cloudCoverage },
    precipitation: { intensity: weather.precipitationIntensity, type: weather.kind === "storm" || weather.kind === "rain" ? "rain" : "none", dropletDensity: weather.precipitationIntensity * 800 },
    terrain: { height, slope, biome: slope > 0.4 ? "mountain" : height < 0 ? "wetland" : "plains", wetness: weather.precipitationIntensity * 0.6, snow: 0 },
    ocean: { waveAmplitude: 1 + wind.speed * 0.3, waveFrequency: 0.2, foam: wind.speed > 6 ? 0.4 : 0, depth: opts.oceanDepth ?? 0, roughness: 0.4 + wind.turbulence * 0.3 },
    localSurface: { material: height < 0 ? "water" : "rock", wetness: weather.precipitationIntensity, puddles: weather.precipitationIntensity * 0.5, dust: 1 - weather.precipitationIntensity },
    localEffectBudget: "MEDIUM",
  };
}
