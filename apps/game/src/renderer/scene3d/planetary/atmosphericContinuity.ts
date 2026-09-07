// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/atmosphericContinuity.ts - 10.G G6-G7 Atmospheric Continuity (Orbit limb->High cloud->Low haze->Surface fog) + Terrain Sun Moving Shadows valley dark->shadow line. Zoom dari blueprint G6-G7.

// WIRE NOTE for SESSION 2: import { deriveAtmosphericContinuity, tickAtmosphere, tickTerrainShadows } from "./planetary/atmosphericContinuity" di scene3d/index.ts.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export interface AtmosphericContinuity {
  haze: number; // 0..1 (orbit limb)
  valleyFog: number; // 0..1
  mountainContrast: number; // 0..1
  shadowProgress: number; // 0..1 sunrise shadow line
}

export function deriveAtmosphericContinuity(ctx: EnvironmentalContext, cameraAltitude: number, sunElevation: number): AtmosphericContinuity {
  const haze = ctx.atmosphere.haze * (0.4 + cameraAltitude / 5000);
  const valleyFog = ctx.terrain.height < 80 && ctx.atmosphere.haze > 0.3 ? 0.6 + ctx.atmosphere.haze * 0.4 : ctx.atmosphere.haze * 0.3;
  const mountainContrast = ctx.terrain.slope > 0.3 ? 0.8 + haze * 0.2 : 0.4 + haze * 0.3;
  // Shadow line: sunrise behind mountain, valley dark -> shadow moves across valley
  // sunElevation 0..0.5 -> shadowProgress 0..1
  const shadowProgress = Math.max(0, Math.min(1, (sunElevation + 0.2) / 0.7));
  return { haze: Math.min(1, haze), valleyFog: Math.min(1, valleyFog), mountainContrast: Math.min(1, mountainContrast), shadowProgress };
}

export function tickAtmosphere(sys: { fog: THREE.FogExp2 }, cont: AtmosphericContinuity, dt: number): void {
  // Haze -> fog density lerp (already in fog.ts, but this is optical continuity)
  sys.fog.density = 0.00008 + cont.haze * 0.00022 + cont.valleyFog * 0.00012;
}

export function tickTerrainShadows(shadowPlane: THREE.Mesh, cont: AtmosphericContinuity, sunDirection: { x: number; y: number; z: number }): void {
  // Shadow plane 3000x3000, opacity via mountainContrast + shadowProgress
  const mat = shadowPlane.material as THREE.MeshBasicMaterial;
  const target = cont.mountainContrast * 0.18 * (1 - cont.shadowProgress * 0.4);
  mat.opacity = Math.min(0.22, target);
  shadowPlane.visible = mat.opacity > 0.02;
  // Move shadow line via sun direction
  shadowPlane.position.x = sunDirection.x * 1200 * (1 - cont.shadowProgress);
  shadowPlane.position.z = sunDirection.z * 1200 * (1 - cont.shadowProgress);
}
