// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";
import type { CinematicContext } from "./CinematicContext";

export interface AudioState {
  windGain: number;
  windPitch: number;
  rainGain: number;
  rainPitch: number;
  thunderGain: number;
  thunderDelay: number;
  engineGain: number;
  enginePitch: number;
  atmosphereGain: number;
  masterGain: number;
}

export interface AudioTickOpts {
  distanceToLightning: number;
  vesselVelocity: number;
  dt: number;
}

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

export function deriveAudioState(
  env: EnvironmentalContext,
  cinematic: CinematicContext | null,
  opts: AudioTickOpts,
): AudioState {
  const windInt = clamp01(env.wind.speed / 14);
  const gust = env.wind.gustStrength;
  const turb = env.wind.turbulence;
  const density = env.atmosphere.density;
  const rainInt = env.weather.precipitationIntensity;
  const cloudDense = env.clouds.density;
  const scattering = env.atmosphere.scattering;
  const phaseMul = cinematic ? (cinematic.phase === "PEAK" ? 1.18 : cinematic.phase === "ACTIVE" ? 1.06 : 0.92) : 1;
  const windGain = clamp01((0.12 + windInt * 0.58 + gust * 0.18 + turb * 0.12) * density * phaseMul);
  const windPitch = 0.92 + windInt * 0.28 + gust * 0.12;
  const rainGain = clamp01(rainInt * (0.72 + cloudDense * 0.28) * (0.6 + density * 0.4));
  const rainPitch = 0.94 + rainInt * 0.22;
  const thunderBase = opts.distanceToLightning < 6000 ? 1 - opts.distanceToLightning / 6000 : 0;
  const thunderGain = clamp01(thunderBase * (0.45 + rainInt * 0.35) * (cinematic?.eventType === "LIGHTNING" ? 1.35 : 1));
  const thunderDelay = opts.distanceToLightning / 343;
  const engineInt = clamp01(opts.vesselVelocity / 180);
  const engineGain = clamp01(0.18 + engineInt * 0.52 + windInt * 0.08);
  const enginePitch = 0.88 + engineInt * 0.42;
  const atmosphereGain = clamp01(0.08 + scattering * 0.22 + (1 - env.atmosphere.visibility / 12000) * 0.18);
  const masterGain = clamp01(0.62 + windGain * 0.12 + rainGain * 0.08);
  return { windGain, windPitch, rainGain, rainPitch, thunderGain, thunderDelay, engineGain, enginePitch, atmosphereGain, masterGain };
}

export function tickAudioState(prev: AudioState, next: AudioState, dt: number): AudioState {
  const a = 1 - Math.exp(-dt * 3.2);
  return {
    windGain: lerp(prev.windGain, next.windGain, a),
    windPitch: lerp(prev.windPitch, next.windPitch, a),
    rainGain: lerp(prev.rainGain, next.rainGain, a),
    rainPitch: lerp(prev.rainPitch, next.rainPitch, a),
    thunderGain: lerp(prev.thunderGain, next.thunderGain, Math.min(1, dt * 4.5)),
    thunderDelay: next.thunderDelay,
    engineGain: lerp(prev.engineGain, next.engineGain, a),
    enginePitch: lerp(prev.enginePitch, next.enginePitch, a),
    atmosphereGain: lerp(prev.atmosphereGain, next.atmosphereGain, a),
    masterGain: lerp(prev.masterGain, next.masterGain, a),
  };
}

export function shouldPlayThunder(state: AudioState, prevGain: number): boolean {
  return state.thunderGain > 0.22 && state.thunderGain > prevGain + 0.18;
}
