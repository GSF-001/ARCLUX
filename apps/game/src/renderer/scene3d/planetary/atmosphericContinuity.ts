// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/atmosphericContinuity.ts - 10.G G6-G7 Atmospheric Continuity (Orbit limb->High cloud->Low haze->Surface fog) + Terrain Sun Moving Shadows.

// Wired via planetary/wireG — ticked per frame from EnvironmentalContext.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export interface AtmosphericContinuity {
  haze: number;
  valleyFog: number;
  mountainContrast: number;
  shadowProgress: number;
  horizonGlow: number;
  entryHaze: number;
}

export function deriveAtmosphericContinuity(ctx: EnvironmentalContext, cameraAltitude: number, sunElevation: number): AtmosphericContinuity {
  const baseHaze = ctx.atmosphere.haze;
  const scattering = ctx.atmosphere.scattering;
  const haze = Math.min(1, baseHaze * (0.42 + cameraAltitude / 4800) + scattering * 0.14);
  const valleyFog = ctx.terrain.height < 78 && baseHaze > 0.26
    ? 0.58 + baseHaze * 0.42 + (1 - ctx.terrain.slope) * 0.12
    : ctx.terrain.height < 140 ? baseHaze * 0.52 + 0.08
    : baseHaze * 0.28;
  const mountainContrast = ctx.terrain.slope > 0.28 ? 0.82 + haze * 0.18 : ctx.terrain.slope > 0.14 ? 0.56 + haze * 0.22 : 0.38 + haze * 0.28;
  const shadowProgress = Math.max(0, Math.min(1, (sunElevation + 0.22) / 0.72));
  const horizonGlow = Math.max(0, 0.62 - Math.abs(sunElevation) * 0.72) * (0.42 + scattering * 0.58);
  const entryHaze = cameraAltitude > 1800 ? Math.min(1, (cameraAltitude - 1800) / 6200 + baseHaze * 0.32) : baseHaze * 0.18;
  return { haze: Math.min(1, haze), valleyFog: Math.min(1, valleyFog), mountainContrast: Math.min(1, mountainContrast), shadowProgress, horizonGlow: Math.min(1, horizonGlow), entryHaze: Math.min(1, entryHaze) };
}

export function tickAtmosphere(sys: { fog: THREE.FogExp2 }, cont: AtmosphericContinuity, dt: number): void {
  const target = 0.00008 + cont.haze * 0.00022 + cont.valleyFog * 0.00013 + cont.entryHaze * 0.00008;
  sys.fog.density += (target - sys.fog.density) * Math.min(1, dt * 1.4);
  sys.fog.color.setHSL(0.58 + cont.horizonGlow * 0.06, 0.22 + cont.haze * 0.18, 0.72 + cont.horizonGlow * 0.08);
}

export function tickTerrainShadows(shadowPlane: THREE.Mesh, cont: AtmosphericContinuity, sunDirection: { x: number; y: number; z: number }): void {
  const mat = shadowPlane.material as THREE.MeshBasicMaterial;
  const base = cont.mountainContrast * 0.18 * (1 - cont.shadowProgress * 0.42);
  const valleyBoost = cont.valleyFog * 0.04;
  const target = Math.min(0.24, base + valleyBoost);
  mat.opacity += (target - mat.opacity) * 0.12;
  shadowPlane.visible = mat.opacity > 0.02;
  const drift = 1200 * (1 - cont.shadowProgress);
  shadowPlane.position.x += (sunDirection.x * drift - shadowPlane.position.x) * 0.08;
  shadowPlane.position.z += (sunDirection.z * drift - shadowPlane.position.z) * 0.08;
  shadowPlane.rotation.y = Math.atan2(sunDirection.z, sunDirection.x) * 0.12;
}

export function createShadowPlane(): THREE.Mesh {
  const g = new THREE.PlaneGeometry(3600, 3600);
  const m = new THREE.MeshBasicMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.12;
  mesh.name = "terrainShadowPlane";
  mesh.visible = false;
  mesh.frustumCulled = false;
  return mesh;
}
