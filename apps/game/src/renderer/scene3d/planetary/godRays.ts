// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/godRays.ts - 10.X.1 GodRayContext mandatory: mountain gap/valley/canopy/cloud gap shafts, coupled sun+fog+cloud+terrain+camera. Zoom dari blueprint "GodRayContext { sunDirection/elevation/intensity, atmosphericDensity, fogDensity, cloudDensity/coverage, terrain/vegetation occlusion, weather, visibility, cameraPosition }".

// Blueprint 10.X §5 cuma "God Rays mandatory ... through mountain gaps/valleys/canopy/cloud gaps — coupled, not static overlay".
// File ini ZOOM jadi: GodRayContext derived dari EnvironmentalContext + visibility/terrain, shafts via THREE Volumetric (cone geometry + shader-like opacity), occlusion via heightmap, gak overlay statik.
// WIRE NOTE for SESSION 2: import { createGodRaySystem, updateGodRays } from "./planetary/godRays" di scene3d/index.ts. Create sekali, update tiap frame dengan EnvironmentalContext + cameraPosition + terrain occlusion.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

// ---------------------------------------------------------------------------
// GodRayContext — single source, derived, gak persist
// ---------------------------------------------------------------------------

export interface GodRayContext {
  sunDirection: { x: number; y: number; z: number };
  sunElevation: number;
  sunIntensity: number;
  atmosphericDensity: number; // 0..1
  fogDensity: number; // 0..1
  cloudDensity: number;
  cloudCoverage: number;
  terrainOcclusion: number; // 0..1 (mountain gap 0, canopy 0.8)
  visibility: number; // m
  weatherKind: "clear" | "overcast" | "rain" | "storm";
  cameraPosition: { x: number; y: number; z: number };
  gaps: number; // 0..1 (cloud gaps = 1 - coverage)
}

export function deriveGodRayContext(
  ctx: EnvironmentalContext,
  cameraPosition: { x: number; y: number; z: number },
  terrainOcclusion = 0.3, // default 0.3, SESSION 2 bisa raycast heightmap untuk gap
): GodRayContext {
  return {
    sunDirection: ctx.sun.direction,
    sunElevation: ctx.sun.elevation,
    sunIntensity: ctx.sun.intensity,
    atmosphericDensity: ctx.atmosphere.density,
    fogDensity: ctx.atmosphere.haze * 0.6 + (ctx.clouds.thickness / 1500) * 0.2,
    cloudDensity: ctx.clouds.density,
    cloudCoverage: ctx.clouds.coverage,
    terrainOcclusion,
    visibility: ctx.atmosphere.visibility,
    weatherKind: ctx.weather.kind,
    cameraPosition,
    gaps: ctx.clouds.gaps,
  };
}

// ---------------------------------------------------------------------------
// God ray shafts — cone geometry, opacity coupled
// ---------------------------------------------------------------------------

export interface GodRaySystem {
  group: THREE.Group;
  shafts: THREE.Mesh[]; // 6 shafts pool
}

export function createGodRaySystem(): GodRaySystem {
  const group = new THREE.Group();
  group.name = "godRays";
  const shafts: THREE.Mesh[] = [];
  // 6 volumetric cones (height 800, radius 120) — pool, gak alloc tiap frame
  for (let i = 0; i < 6; i++) {
    const geo = new THREE.ConeGeometry(120, 800, 8, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff2c0, // warm sun
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 400; // cone center 400m up
    mesh.rotation.x = Math.PI; // point down (sun -> surface)
    mesh.visible = false;
    mesh.name = `godRay-${i}`;
    // Random gap offset biar shafts gak numpuk
    (mesh as any)._gapPos = new THREE.Vector2((Math.random() - 0.5) * 1800, (Math.random() - 0.5) * 1800);
    group.add(mesh);
    shafts.push(mesh);
  }
  return { group, shafts };
}

/**
 * Update tiap frame: coupled sun+fog+cloud+terrain+camera, bukan overlay statik.
 * - sunIntensity <0.15 atau elevation <0.12 -> invisible (sun low/gak ada)
 * - cloudCoverage 0.9 + fog 0.6 -> opacity 0.18, clear -> 0.03
 * - terrainOcclusion 0.8 (canopy) -> opacity x0.4, gap -> x1.2
 * - visibility <2000 (storm) -> shafts lebih pendek + lebih tebal
 * - cameraPosition -> shafts orient ke sunDirection, fade dengan distance
 */
export function updateGodRays(
  sys: GodRaySystem,
  gctx: GodRayContext,
  dt: number,
): void {
  const sunLow = gctx.sunElevation < 0.12 || gctx.sunIntensity < 0.15;
  const heavyCloud = gctx.cloudCoverage > 0.85 && gctx.fogDensity > 0.5;
  if (sunLow && !heavyCloud) {
    sys.shafts.forEach((s) => (s.visible = false));
    return;
  }

  // Base opacity: sunIntensity 0.8 * gaps 0.4 * (1 - terrainOcclusion 0.3) * fog 0.3
  const baseOpacity =
    gctx.sunIntensity * 0.45 * (0.2 + gctx.gaps * 0.8) * (1 - gctx.terrainOcclusion * 0.6) * (0.3 + gctx.fogDensity * 0.7) * (0.5 + gctx.cloudDensity * 0.5);

  // Visibility -> shaft length/thickness: storm visibility 2000 -> short thick, clear 10000 -> long thin
  const visFactor = Math.min(1, gctx.visibility / 10000);
  const shaftHeight = 400 + visFactor * 600; // 400..1000
  const shaftRadius = 80 + (1 - visFactor) * 80; // 80..160

  sys.shafts.forEach((shaft, idx) => {
    const mat = shaft.material as THREE.MeshBasicMaterial;
    const gapPos = (shaft as any)._gapPos as THREE.Vector2;

    // Wind drift via cloud gap: gaps gerak pelan 2 units/s
    gapPos.x = (gapPos.x + Math.cos(gctx.sunElevation) * 2 * dt * (0.5 + gctx.cloudCoverage * 0.5)) % 2000;
    gapPos.y = (gapPos.y + Math.sin(gctx.sunElevation) * 2 * dt * (0.5 + gctx.cloudCoverage * 0.5)) % 2000;

    shaft.position.x = gapPos.x;
    shaft.position.z = gapPos.y;
    shaft.position.y = shaftHeight / 2;

    // Orient ke sun direction (shafts point dari sun)
    const sunDir = new THREE.Vector3(gctx.sunDirection.x, gctx.sunDirection.y, gctx.sunDirection.z).normalize();
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), sunDir);

    // Scale via visFactor
    shaft.scale.set(shaftRadius / 120, shaftHeight / 800, shaftRadius / 120);

    // Opacity coupled + flicker halus via time
    const flicker = 0.92 + Math.sin(Date.now() * 0.0007 + idx * 1.3) * 0.08;
    const weatherMul = gctx.weatherKind === "storm" ? 1.3 : gctx.weatherKind === "clear" ? 0.7 : 1;
    mat.opacity = Math.min(0.22, baseOpacity * flicker * weatherMul);
    // Color via sun: dawn warm, day white, storm grey-yellow
    const isWarm = gctx.sunElevation < 0.5;
    mat.color.set(isWarm ? 0xfff2c0 : gctx.weatherKind === "storm" ? 0xd9ccaa : 0xffffff);

    // Distance fade: camera jauh >800m dari shaft -> fade
    const camDist = Math.hypot(shaft.position.x - gctx.cameraPosition.x, shaft.position.z - gctx.cameraPosition.z);
    const distFade = camDist > 800 ? Math.max(0, 1 - (camDist - 800) / 1200) : 1;
    mat.opacity *= distFade;

    shaft.visible = mat.opacity > 0.015;
  });
}

// WIRE NOTE: SESSION 2
// import { deriveGodRayContext, createGodRaySystem, updateGodRays } from "./planetary/godRays";
// const godRays = createGodRaySystem(); ctx.scene.add(godRays.group);
// // di frame loop: const gctx = deriveGodRayContext(envCtx, camera.position, terrainOcclusion); updateGodRays(godRays, gctx, dt);
