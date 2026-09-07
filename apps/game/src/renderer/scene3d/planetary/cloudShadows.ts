// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/cloudShadows.ts - 10.X.1 moving cloud shadows.
// A small pool of dark translucent planes drifts with the shared wind field,
// dimming terrain and vegetation where clouds block the sun.
// Visual-only: reads EnvironmentalContext, never writes authority state.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

const PLANE_COUNT = 4;
const PLANE_SIZE = 4000;
const SHADOW_Y = 0.15;
const MAX_OPACITY = 0.28;
const VISIBILITY_THRESHOLD = 0.02;

export interface CloudShadowSystem {
  group: THREE.Group;
  planes: THREE.Mesh[];
  baseOpacity: number;
  lastOpacity: number;
}

export interface CloudShadowPlaneUserData {
  offsetX: number;
  offsetY: number;
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

/** Create the pooled shadow quads. Seed keeps placement deterministic. */
export function createCloudShadowSystem(seed = 0x10c10d): CloudShadowSystem {
  const group = new THREE.Group();
  group.name = "cloudShadows";
  const planes: THREE.Mesh[] = [];
  const rng = mulberry32(seed);
  for (let i = 0; i < PLANE_COUNT; i++) {
    const geo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = SHADOW_Y;
    mesh.visible = false;
    mesh.name = `cloudShadow-${i}`;
    const userData: CloudShadowPlaneUserData = {
      offsetX: rng() * PLANE_SIZE,
      offsetY: rng() * PLANE_SIZE,
    };
    mesh.userData = { ...mesh.userData, ...userData };
    group.add(mesh);
    planes.push(mesh);
  }
  return { group, planes, baseOpacity: 0.0, lastOpacity: 0 };
}

function planeOffset(plane: THREE.Mesh): CloudShadowPlaneUserData {
  return plane.userData as CloudShadowPlaneUserData;
}

/**
 * Advance shadows one frame.
 * @param timeSec deterministic clock (worldTime/1000 + tick * dt), never Date.now
 * @param anchor world position the planes follow (defaults to origin)
 */
export function tickCloudShadows(
  sys: CloudShadowSystem,
  ctx: EnvironmentalContext,
  dt: number,
  timeSec?: number,
  anchor?: { x: number; z: number },
): void {
  const now = timeSec ?? ctx.worldTime / 1000 + ctx.simulationTick * 0.1;
  const night = ctx.timeOfDay === "night" || ctx.sun.intensity < 0.05;
  if (night) {
    for (const p of sys.planes) p.visible = false;
    sys.lastOpacity = 0;
    return;
  }
  const wind = ctx.wind;
  const clouds = ctx.clouds;
  const sun = ctx.sun;

  const targetOpacity = Math.min(MAX_OPACITY, clouds.density * 0.22 + clouds.coverage * 0.12);
  const elevationFactor = 1.4 - Math.min(1.0, Math.max(0, sun.elevation)) * 0.6;
  const opacity = targetOpacity * elevationFactor;
  sys.lastOpacity = opacity;

  const speed = wind.speed * 3.0;
  const dirX = Math.cos(wind.direction);
  const dirZ = Math.sin(wind.direction);
  const ax = anchor?.x ?? 0;
  const az = anchor?.z ?? 0;

  sys.planes.forEach((plane, idx) => {
    const mat = plane.material as THREE.MeshBasicMaterial;
    const offset = planeOffset(plane);

    const turb = 1 + wind.turbulence * 0.4 * Math.sin(now * 0.3 + idx * 1.7);
    const drift = 0.8 + wind.localVariation * 0.4;
    offset.offsetX = (offset.offsetX + dirX * speed * turb * dt * drift) % PLANE_SIZE;
    offset.offsetY = (offset.offsetY + dirZ * speed * turb * dt * drift) % PLANE_SIZE;

    plane.position.x = ax + offset.offsetX - PLANE_SIZE / 2;
    plane.position.z = az + offset.offsetY - PLANE_SIZE / 2;

    const stretch = sun.elevation < 0.4 ? 1 + (0.4 - sun.elevation) * 1.8 : 1;
    plane.scale.set(stretch, 1, 1);
    plane.rotation.z = wind.direction;

    mat.opacity = opacity * (0.85 + wind.gustStrength * 0.15);
    plane.visible = opacity > VISIBILITY_THRESHOLD;
  });
}

/** Current shadow strength for vegetation and terrain tinting. */
export function getCloudShadowOpacity(sys: CloudShadowSystem): number {
  return sys.lastOpacity;
}

/** Shadow strength at a world position, fading with distance to the quad edge. */
export function getShadowIntensityAt(sys: CloudShadowSystem, pos: { x: number; z: number }): number {
  const op = sys.lastOpacity;
  if (op <= 0) return 0;
  let minDist = Infinity;
  for (const p of sys.planes) {
    if (!p.visible) continue;
    const d = Math.hypot(p.position.x - pos.x, p.position.z - pos.z);
    if (d < minDist) minDist = d;
  }
  if (!Number.isFinite(minDist) || minDist >= PLANE_SIZE / 2) return 0;
  return op * (1 - minDist / (PLANE_SIZE / 2));
}
