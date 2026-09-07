// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/oceanSystem.ts - 10.X.3 vessel-ocean interaction.
// Derives the per-frame ocean state (amplitude, roughness, foam, sun
// reflection) from authority ocean, wind, sun, and cloud state, and drives
// the vessel wake ribbon plus advected spray. The base wave surface itself
// lives in ocean.ts; this file only adds the interaction layer.
// Visual-only: reads state, never writes authority.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

const WAKE_SPEED_MIN = 2;
const WAKE_LENGTH = 14;
const SPRAY_COUNT = 400;
const SPRAY_HALF = 8;
const SPRAY_HEIGHT = 8;

export interface OceanFrameState {
  waveAmplitude: number;
  waveFrequency: number;
  roughness: number;
  foam: number;
  reflection: number; // 0..1 sun specular
}

export function deriveOceanFrame(ctx: EnvironmentalContext, vesselSpeed: number): OceanFrameState {
  const ocean = ctx.ocean;
  const wind = ctx.wind;
  const sun = ctx.sun;
  const windAmp = ocean.waveAmplitude * (0.7 + wind.speed * 0.06);
  const roughness = Math.min(0.85, ocean.roughness * (0.6 + wind.turbulence * 0.5) + vesselSpeed * 0.02);
  const reflection = sun.intensity * (1 - roughness * 0.4) * (1 - ctx.clouds.coverage * 0.25) * 0.9;
  const foam = Math.min(
    1,
    ocean.foam * 0.7 + (wind.speed > 6 ? 0.25 : 0) + (vesselSpeed > 4 ? 0.2 : 0),
  );
  return { waveAmplitude: windAmp, waveFrequency: ocean.waveFrequency, roughness, foam, reflection };
}

export interface OceanWakeSystem {
  wakeMesh: THREE.Mesh;
  sprayPoints: THREE.Points;
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

/** Build the wake ribbon and spray pool. Seed keeps init deterministic. */
export function createOceanWake(seed = 0x0ce4): OceanWakeSystem {
  const wakeGeo = new THREE.PlaneGeometry(12, 40);
  const wakeMat = new THREE.MeshBasicMaterial({
    color: 0xaaccff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wake = new THREE.Mesh(wakeGeo, wakeMat);
  wake.rotation.x = -Math.PI / 2;
  wake.position.y = 0.08;
  wake.name = "oceanWake";
  wake.visible = false;

  const rng = mulberry32(seed);
  const sprayGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(SPRAY_COUNT * 3);
  for (let i = 0; i < SPRAY_COUNT; i++) {
    pos[i * 3] = (rng() - 0.5) * SPRAY_HALF;
    pos[i * 3 + 1] = rng() * SPRAY_HEIGHT;
    pos[i * 3 + 2] = (rng() - 0.5) * SPRAY_HALF;
  }
  sprayGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const sprayMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.45,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const spray = new THREE.Points(sprayGeo, sprayMat);
  spray.name = "oceanSpray";
  spray.frustumCulled = false;
  return { wakeMesh: wake, sprayPoints: spray };
}

/**
 * Advance wake and spray one frame. Spray advects downwind and wraps inside
 * its box, so motion stays smooth instead of jittering randomly.
 */
export function tickOcean(
  sys: OceanWakeSystem,
  state: OceanFrameState,
  vesselPos: { x: number; z: number; heading: number },
  vesselSpeed: number,
  dt: number,
  wind?: { direction: number; speed: number },
): void {
  const moving = vesselSpeed > WAKE_SPEED_MIN;
  sys.wakeMesh.visible = moving;
  sys.sprayPoints.visible = moving && state.foam > 0.25;
  if (!moving) return;

  sys.wakeMesh.position.x = vesselPos.x - Math.cos(vesselPos.heading) * WAKE_LENGTH;
  sys.wakeMesh.position.z = vesselPos.z - Math.sin(vesselPos.heading) * WAKE_LENGTH;
  sys.wakeMesh.rotation.z = vesselPos.heading;
  (sys.wakeMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(
    0.45,
    state.foam * 0.6 + vesselSpeed * 0.03,
  );

  const mat = sys.sprayPoints.material as THREE.PointsMaterial;
  mat.opacity = Math.min(0.55, state.foam * 0.5);
  const windDir = wind?.direction ?? 0;
  const windSpeed = wind?.speed ?? 0;
  const advX = Math.cos(windDir) * windSpeed * dt * 0.6;
  const advZ = Math.sin(windDir) * windSpeed * dt * 0.6;
  const fall = 4 + state.waveAmplitude * 2;
  const pos = sys.sprayPoints.geometry.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) - fall * dt;
    let x = pos.getX(i) + advX;
    let z = pos.getZ(i) + advZ;
    if (y < 0) y += SPRAY_HEIGHT + 2;
    if (x > SPRAY_HALF / 2) x -= SPRAY_HALF;
    else if (x < -SPRAY_HALF / 2) x += SPRAY_HALF;
    if (z > SPRAY_HALF / 2) z -= SPRAY_HALF;
    else if (z < -SPRAY_HALF / 2) z += SPRAY_HALF;
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  sys.sprayPoints.position.set(vesselPos.x, 2, vesselPos.z);
}

export function getOceanReflectionStrength(state: OceanFrameState, sunIntensity: number): number {
  return state.reflection * (0.8 + sunIntensity * 0.2);
}

export function shouldShowWake(state: OceanFrameState, speed: number): boolean {
  return speed > 2.5 && state.roughness < 0.85;
}
