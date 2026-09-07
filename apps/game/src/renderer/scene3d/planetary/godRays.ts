// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/godRays.ts - 10.X.1 volumetric light shafts.
// Shafts appear through mountain gaps, valleys, canopy breaks, and cloud gaps.
// Opacity couples sun, fog, cloud cover, terrain occlusion, weather, and camera
// distance. Cone meshes approximate volumetrics without a postprocess pass.
// Visual-only: reads EnvironmentalContext, never writes authority state.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

const SHAFT_COUNT = 6;
const SHAFT_BASE_HEIGHT = 800;
const SHAFT_BASE_RADIUS = 120;
const FIELD_HALF = 1800;
const MAX_OPACITY = 0.22;
const VISIBILITY_THRESHOLD = 0.015;

export interface GodRayContext {
  sunDirection: { x: number; y: number; z: number };
  sunElevation: number;
  sunIntensity: number;
  atmosphericDensity: number; // 0..1
  fogDensity: number; // 0..1
  cloudDensity: number;
  cloudCoverage: number;
  terrainOcclusion: number; // 0..1 (0 = open gap, 0.8 = dense canopy)
  visibility: number; // meters
  weatherKind: "clear" | "overcast" | "rain" | "storm";
  cameraPosition: { x: number; y: number; z: number };
  gaps: number; // 0..1 cloud gaps (1 - coverage)
}

/**
 * Derive the shaft context from authority state.
 * terrainOcclusion should come from a heightmap raycast when available;
 * the default is a neutral mid value.
 */
export function deriveGodRayContext(
  ctx: EnvironmentalContext,
  cameraPosition: { x: number; y: number; z: number },
  terrainOcclusion = 0.3,
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

export interface GodRaySystem {
  group: THREE.Group;
  shafts: THREE.Mesh[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _sunDir = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

/** Create the pooled shaft cones. Seed keeps gap placement deterministic. */
export function createGodRaySystem(seed = 0x609d): GodRaySystem {
  const group = new THREE.Group();
  group.name = "godRays";
  const shafts: THREE.Mesh[] = [];
  const rng = mulberry32(seed);
  for (let i = 0; i < SHAFT_COUNT; i++) {
    const geo = new THREE.ConeGeometry(SHAFT_BASE_RADIUS, SHAFT_BASE_HEIGHT, 8, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff2c0,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = SHAFT_BASE_HEIGHT / 2;
    mesh.rotation.x = Math.PI;
    mesh.visible = false;
    mesh.name = `godRay-${i}`;
    mesh.userData = {
      ...mesh.userData,
      gapX: (rng() - 0.5) * FIELD_HALF,
      gapZ: (rng() - 0.5) * FIELD_HALF,
    };
    group.add(mesh);
    shafts.push(mesh);
  }
  return { group, shafts };
}

/** Cheap visibility pre-check so callers can skip the full update. */
export function isGodRayVisible(gctx: GodRayContext): boolean {
  return gctx.sunIntensity > 0.12 && gctx.sunElevation > 0.08 && gctx.gaps > 0.08;
}

export function godRayIntensity(gctx: GodRayContext): number {
  return (
    gctx.sunIntensity *
    gctx.gaps *
    (1 - gctx.terrainOcclusion * 0.5) *
    (0.4 + gctx.fogDensity * 0.6)
  );
}

/**
 * Update shafts one frame. timeSec is the deterministic clock
 * (worldTime/1000 + tick * dt); it drives drift and shimmer.
 */
export function updateGodRays(
  sys: GodRaySystem,
  gctx: GodRayContext,
  dt: number,
  timeSec?: number,
): void {
  const now = timeSec ?? 0;
  const sunLow = gctx.sunElevation < 0.12 || gctx.sunIntensity < 0.15;
  const heavyCloud = gctx.cloudCoverage > 0.85 && gctx.fogDensity > 0.5;
  if (sunLow && !heavyCloud) {
    for (const s of sys.shafts) s.visible = false;
    return;
  }

  const baseOpacity =
    gctx.sunIntensity *
    0.45 *
    (0.2 + gctx.gaps * 0.8) *
    (1 - gctx.terrainOcclusion * 0.6) *
    (0.3 + gctx.fogDensity * 0.7) *
    (0.5 + gctx.cloudDensity * 0.5);

  const visFactor = Math.min(1, gctx.visibility / 10000);
  const shaftHeight = 400 + visFactor * 600;
  const shaftRadius = 80 + (1 - visFactor) * 80;
  const weatherMul = gctx.weatherKind === "storm" ? 1.3 : gctx.weatherKind === "clear" ? 0.7 : 1;
  const isWarm = gctx.sunElevation < 0.5;

  _sunDir.set(gctx.sunDirection.x, gctx.sunDirection.y, gctx.sunDirection.z).normalize();

  sys.shafts.forEach((shaft, idx) => {
    const mat = shaft.material as THREE.MeshBasicMaterial;
    const gapDrift = 0.5 + gctx.cloudCoverage * 0.5;
    let gapX = (shaft.userData["gapX"] as number) + Math.cos(gctx.sunElevation) * 2 * dt * gapDrift;
    let gapZ = (shaft.userData["gapZ"] as number) + Math.sin(gctx.sunElevation) * 2 * dt * gapDrift;
    gapX = ((gapX % 2000) + 2000) % 2000 - 1000;
    gapZ = ((gapZ % 2000) + 2000) % 2000 - 1000;
    shaft.userData["gapX"] = gapX;
    shaft.userData["gapZ"] = gapZ;

    shaft.position.x = gapX;
    shaft.position.z = gapZ;
    shaft.position.y = shaftHeight / 2;
    shaft.quaternion.setFromUnitVectors(_down, _sunDir);
    shaft.scale.set(shaftRadius / SHAFT_BASE_RADIUS, shaftHeight / SHAFT_BASE_HEIGHT, shaftRadius / SHAFT_BASE_RADIUS);

    const flicker = 0.92 + Math.sin(now * 0.7 + idx * 1.3) * 0.08;
    let opacity = Math.min(MAX_OPACITY, baseOpacity * flicker * weatherMul);
    mat.color.set(isWarm ? 0xfff2c0 : gctx.weatherKind === "storm" ? 0xd9ccaa : 0xffffff);

    const camDist = Math.hypot(
      shaft.position.x - gctx.cameraPosition.x,
      shaft.position.z - gctx.cameraPosition.z,
    );
    if (camDist > 800) opacity *= Math.max(0, 1 - (camDist - 800) / 1200);
    mat.opacity = opacity;
    shaft.visible = opacity > VISIBILITY_THRESHOLD;
  });
}
