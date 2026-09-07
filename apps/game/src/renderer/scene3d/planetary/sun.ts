// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/sun.ts - 10.X.1 solar resolver.
// Derives render uniforms from EnvironmentalContext.sun and applies them to
// the scene directional light, ambient light, and exponential fog.
// Visual-only: reads authority state, never writes it.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

// Sun uniforms consumed by terrain, ocean, vegetation, and cloud resolvers.
export interface SunUniforms {
  direction: THREE.Vector3; // normalized
  elevation: number; // radians, 0 = horizon, PI/2 = zenith
  intensity: number; // 0..1 (1 = noon clear, 0 = night)
  color: THREE.Color;
  transmission: number; // 0..1 atmospheric transmission (1 = clear)
  timeOfDay: "dawn" | "day" | "dusk" | "night";
}

const _scratchColor = new THREE.Color();
const NIGHT_AMBIENT = 0.18;
const NIGHT_FOG_DENSITY = 0.00035;
const DAY_FOG_DENSITY = 0.00008;
const STORM_FOG_DENSITY = 0.00035;
const FOG_TINT = 0x8aa0b8;

/** Derive render uniforms from the authoritative sun state. */
export function sunUniformsFromContext(ctx: EnvironmentalContext): SunUniforms {
  const s = ctx.sun;
  return {
    direction: new THREE.Vector3(s.direction.x, s.direction.y, s.direction.z).normalize(),
    elevation: s.elevation,
    intensity: s.intensity,
    color: new THREE.Color(s.color),
    transmission: s.atmosphericTransmission,
    timeOfDay: ctx.timeOfDay,
  };
}

export interface SunScene {
  sunLight: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  fog?: THREE.FogExp2;
}

function isNight(u: SunUniforms): boolean {
  return u.timeOfDay === "night" || u.intensity < 0.05;
}

/**
 * Apply sun uniforms to scene lights. Called once per frame.
 * Night: sun off so facility emissive stays visible; low ambient kept.
 * Day: warm tint near dawn/dusk, haze widens shadow bias and fog density.
 */
export function updateSunFromContext(scene: SunScene, u: SunUniforms): void {
  if (isNight(u)) {
    scene.sunLight.intensity = 0;
    scene.sunLight.visible = false;
    scene.ambient.intensity = NIGHT_AMBIENT;
    if (scene.fog) scene.fog.density = NIGHT_FOG_DENSITY;
    return;
  }
  scene.sunLight.visible = true;
  scene.sunLight.intensity = 0.9 + u.intensity * 1.6;
  scene.sunLight.color.copy(u.color);
  scene.sunLight.position.copy(u.direction).multiplyScalar(5000);
  scene.sunLight.target.position.set(0, 0, 0);
  const haze = 1 - u.transmission;
  scene.sunLight.shadow.bias = -0.0005 - haze * 0.001;
  scene.ambient.intensity = 0.35 + u.intensity * 0.45;
  scene.ambient.color.copy(u.color).multiplyScalar(0.6);
  if (scene.fog) {
    scene.fog.density = DAY_FOG_DENSITY + haze * (STORM_FOG_DENSITY - DAY_FOG_DENSITY);
    scene.fog.color.copy(u.color).lerp(_scratchColor.set(FOG_TINT), haze * 0.5);
  }
}

/** Tint a standard material with the warm dawn/dusk component of sunlight. */
export function applySunToMaterial(mat: THREE.MeshStandardMaterial, u: SunUniforms): void {
  const warm = u.timeOfDay === "dawn" || u.timeOfDay === "dusk" ? 0.12 : 0;
  mat.emissive.copy(u.color).multiplyScalar(warm * u.intensity);
  mat.emissiveIntensity = warm;
}

/** Fraction of sunlight reaching the surface after atmospheric attenuation. */
export function getSunExposure(u: SunUniforms): number {
  return u.intensity * u.transmission;
}

export function isSunAvailable(u: SunUniforms): boolean {
  return u.intensity > 0.05 && u.timeOfDay !== "night";
}
