// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/sun.ts - 10.X.1 sun: direction/elevation/intensity/color/transmission -> terrain/ocean/vegetation/clouds. Zoom dari blueprint "Sun drives terrain/ocean/vegetation/clouds/atmosphere/facilities/vessels".

// Blueprint 10.X §5 cuma "Sun direction/elevation/intensity/color/transmission/timeOfDay drives...".
// File ini ZOOM jadi resolver fisik: 24h + lunar, elevation -> intensity via sin, color 5800K -> warm dusk, transmission via haze.
// WIRE NOTE for SESSION 2: import { updateSunFromContext } from "./planetary/sun" di scene3d/index.ts frame loop, panggil tiap tick dengan EnvironmentalContext.sun + timeOfDay. Jangan lupa scene.environment + DirectionalLight.

// Visual-only, gak ubah physics/health.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

// ---------------------------------------------------------------------------
// Sun uniforms yang dibaca semua resolver
// ---------------------------------------------------------------------------

export interface SunUniforms {
  direction: THREE.Vector3; // normalized
  elevation: number; // rad
  intensity: number; // 0..1
  color: THREE.Color; // hex -> THREE.Color
  transmission: number; // 0..1 (haze)
  timeOfDay: "dawn" | "day" | "dusk" | "night";
}

/** Derive SunUniforms dari EnvironmentalContext.sun (sudah ada deriveSunState, ini visual uniform). */
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

// ---------------------------------------------------------------------------
// Apply ke THREE — DirectionalLight + scene fog + material uniforms
// ---------------------------------------------------------------------------

export interface SunScene {
  sunLight: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  fog?: THREE.FogExp2;
}

/**
 * Update sun light per tick. Intensitas -> light.intensity + color + shadow.
 * - isNight (intensity<0.05) -> sun off, ambient 0.15 biar night emissive tetep (PMREM off)
 * - dawn/dusk -> warm color + transmission turun (haze)
 * Dipanggil tiap frame, murah (3 set).
 */
export function updateSunFromContext(scene: SunScene, u: SunUniforms): void {
  const isNight = u.timeOfDay === "night" || u.intensity < 0.05;
  if (isNight) {
    scene.sunLight.intensity = 0;
    scene.sunLight.visible = false;
    scene.ambient.intensity = 0.18;
    if (scene.fog) scene.fog.density = 0.00035;
    return;
  }
  scene.sunLight.visible = true;
  scene.sunLight.intensity = 0.9 + u.intensity * 1.6; // 0.9..2.5
  scene.sunLight.color.copy(u.color);
  // direction -> light position (5000m jauh)
  scene.sunLight.position.copy(u.direction).multiplyScalar(5000);
  scene.sunLight.target.position.set(0, 0, 0);
  // transmission -> shadow bias + fog
  const haze = 1 - u.transmission; // 0 clear, 0.8 storm
  scene.sunLight.shadow.bias = -0.0005 - haze * 0.001;
  scene.ambient.intensity = 0.35 + u.intensity * 0.45;
  scene.ambient.color.copy(u.color).multiplyScalar(0.6);
  if (scene.fog) {
    // day clear fog 0.00008, storm/haze 0.00035
    scene.fog.density = 0.00008 + haze * 0.00027;
    scene.fog.color.copy(u.color).lerp(new THREE.Color(0x8aa0b8), haze * 0.5);
  }
}

/** Helper buat material yang butuh sun (terrain/ocean/cloud) — set uniform color/intensity. */
export function applySunToMaterial(mat: THREE.MeshStandardMaterial, u: SunUniforms): void {
  // terrain vertexColors sudah ada, tapi sun tint via emissive kecil
  const warm = u.timeOfDay === "dawn" || u.timeOfDay === "dusk" ? 0.12 : 0;
  (mat as any).emissive = (mat as any).emissive || new THREE.Color(0x000000);
  (mat as any).emissive.copy(u.color).multiplyScalar(warm * u.intensity);
  (mat as any).emissiveIntensity = warm;
}

// WIRE NOTE: SESSION 2 wire di scene3d/index.ts:
// import { sunUniformsFromContext, updateSunFromContext } from "./planetary/sun";
// const u = sunUniformsFromContext(envCtx); updateSunFromContext({ sunLight, ambient, fog }, u);
