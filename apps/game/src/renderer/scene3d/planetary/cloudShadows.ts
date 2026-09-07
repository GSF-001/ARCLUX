// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/cloudShadows.ts - 10.X.1 CLOUD -> MOVING SHADOW -> SURFACE: self-shadow + edge-lit + forest darkens. Zoom dari blueprint "SUN -> CLOUD -> MOVING SHADOW -> SURFACE (forest darkens under cloud)".

// Blueprint 10.X §5 cuma "Clouds self-shadow, edge-lit, sunrise/sunset bright. SUN -> CLOUD -> MOVING SHADOW -> SURFACE".
// File ini ZOOM jadi: shadow plane 4000m, drift via WindState, density -> opacity, sunElevation -> shadow length, forest darkens.
// WIRE NOTE for SESSION 2: import { createCloudShadowSystem, tickCloudShadows } from "./planetary/cloudShadows" di scene3d/index.ts. Create sekali di init, tick tiap frame dengan EnvironmentalContext.wind + clouds + sun.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

// ---------------------------------------------------------------------------
// Cloud shadow system — visual-only, 1 plane per chunk, no physics
// ---------------------------------------------------------------------------

export interface CloudShadowSystem {
  group: THREE.Group; // add ke ctx.scene
  planes: THREE.Mesh[]; // 1 plane per chunk (pool 4)
  baseOpacity: number;
}

export function createCloudShadowSystem(): CloudShadowSystem {
  const group = new THREE.Group();
  group.name = "cloudShadows";
  const planes: THREE.Mesh[] = [];
  // 4 shadow quads (4000x4000) dengan texture noise, pool
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.PlaneGeometry(4000, 4000);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.15; // 15cm di atas terrain biar gak z-fight
    mesh.visible = false;
    mesh.name = `cloudShadow-${i}`;
    // Simpan offset biar drift gak sinkron
    (mesh as any)._offset = new THREE.Vector2(Math.random() * 4000, Math.random() * 4000);
    group.add(mesh);
    planes.push(mesh);
  }
  return { group, planes, baseOpacity: 0.0 };
}

/**
 * Tick tiap frame: drift via WindState + opacity via cloudDensity/coverage + sunElevation.
 * - wind.direction/speed -> offset uv
 * - cloudDensity 0..1 -> opacity 0..0.28
 * - sunElevation <0.2 rad -> shadow panjang + opacity turun 40% (sun low = soft)
 * - timeOfDay night -> invisible
 */
export function tickCloudShadows(
  sys: CloudShadowSystem,
  ctx: EnvironmentalContext,
  dt: number,
): void {
  const isNight = ctx.timeOfDay === "night" || ctx.sun.intensity < 0.05;
  if (isNight) {
    sys.planes.forEach((p) => (p.visible = false));
    return;
  }
  const wind = ctx.wind;
  const clouds = ctx.clouds;
  const sun = ctx.sun;

  // Opacity target: density 0.8 + coverage 0.7 -> 0.26, clear -> 0.02
  const targetOpacity = Math.min(0.28, clouds.density * 0.22 + clouds.coverage * 0.12);
  // Sun low = shadow soft + stretch: elevation 0.2 -> 1, 1.1 -> 0.6
  const elevationFactor = 1.4 - Math.min(1.0, Math.max(0, sun.elevation)) * 0.6;
  const opacity = targetOpacity * elevationFactor;

  // Drift speed: wind.speed 2..10 m/s -> 6..30 units/s di plane
  const speed = wind.speed * 3.0;
  const dirX = Math.cos(wind.direction);
  const dirZ = Math.sin(wind.direction);

  sys.planes.forEach((plane, idx) => {
    const mat = plane.material as THREE.MeshBasicMaterial;
    const offset = (plane as any)._offset as THREE.Vector2;

    // Drift + turbulence + localVariation biar Valley A vs B gak sinkron
    const turb = 1 + wind.turbulence * 0.4 * Math.sin(Date.now() * 0.0003 + idx);
    offset.x = (offset.x + dirX * speed * turb * dt * (0.8 + wind.localVariation * 0.4)) % 4000;
    offset.y = (offset.y + dirZ * speed * turb * dt * (0.8 + wind.localVariation * 0.4)) % 4000;

    // Position plane di atas player (center 0,0 untuk sekarang, SESSION 2 nanti ikutin player pos)
    plane.position.x = offset.x - 2000;
    plane.position.z = offset.y - 2000;

    // Scale shadow length via sun elevation (low sun = shadow panjang)
    const stretch = sun.elevation < 0.4 ? 1 + (0.4 - sun.elevation) * 1.8 : 1;
    plane.scale.set(stretch, 1, 1);
    plane.rotation.z = wind.direction; // shadow arah angin

    mat.opacity = opacity * (0.85 + wind.gustStrength * 0.15);
    plane.visible = opacity > 0.02;
  });

  // Forest darkens hint: SESSION 2 bisa baca opacity di frame loop untuk tint vegetation
  (sys as any)._lastOpacity = opacity;
}

/** Helper buat vegetation/terrain yang mau darkens saat shadow lewat — baca dari system. */
export function getCloudShadowOpacity(sys: CloudShadowSystem): number {
  return (sys as any)._lastOpacity ?? 0;
}

// WIRE NOTE: SESSION 2
// import { createCloudShadowSystem, tickCloudShadows } from "./planetary/cloudShadows";
// const cloudShadows = createCloudShadowSystem(); ctx.scene.add(cloudShadows.group);
// // di frame loop: tickCloudShadows(cloudShadows, envCtx, dt);

export function getShadowIntensityAt(sys: CloudShadowSystem, pos: {x:number,z:number}): number {
  const op = (sys as any)._lastOpacity ?? 0;
  let minDist = Infinity;
  for (const p of sys.planes) {
    const d = Math.hypot(p.position.x - pos.x, p.position.z - pos.z);
    minDist = Math.min(minDist, d);
  }
  return minDist < 2000 ? op * (1 - minDist/2000) : 0;
}

