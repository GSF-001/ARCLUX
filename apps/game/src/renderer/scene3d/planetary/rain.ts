// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/rain.ts - 10.X.2 precipitation resolver.
// Wind-slanted rain particles plus accumulated surface response: wetness,
// puddle decals, and drain/dry recovery after the storm passes.
// Visual-only: derives from EnvironmentalContext, never writes authority state.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

const PARTICLE_COUNT = 2000;
const FIELD_HALF = 300;
const FALL_MIN = 20;
const FALL_RANGE = 200;
const PUDDLE_COUNT = 3;
const PUDDLE_ACCUMULATION = 0.025;
const PUDDLE_DRAIN = 0.015;
const RAIN_VISIBILITY = 0.08;

export interface RainState {
  intensity: number; // 0..1
  slant: THREE.Vector3; // fall direction including wind
  dropletDensity: number; // per cubic meter
  puddleLevel: number; // 0..1 accumulated surface water
  wetness: number; // 0..1 material wetness
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

const _slant = new THREE.Vector3();

/**
 * Derive rain state. accPuddle carries surface water across calls so pools
 * persist after rainfall stops and drain gradually.
 */
export function deriveRainState(ctx: EnvironmentalContext, dt: number, accPuddle: number): RainState {
  const kind = ctx.weather.kind;
  const intensity =
    ctx.weather.precipitationIntensity * (kind === "storm" ? 1 : kind === "rain" ? 0.7 : 0);
  const wind = ctx.wind;
  _slant
    .set(Math.cos(wind.direction) * wind.speed * 0.06, -1, Math.sin(wind.direction) * wind.speed * 0.06)
    .normalize();
  let puddle = accPuddle;
  if (intensity > 0.1) puddle = Math.min(1, puddle + intensity * dt * PUDDLE_ACCUMULATION);
  else puddle = Math.max(0, puddle - dt * PUDDLE_DRAIN);
  const wetness = Math.min(1, intensity * 0.9 + puddle * 0.4);
  return {
    intensity,
    slant: _slant.clone(),
    dropletDensity: intensity * 800,
    puddleLevel: puddle,
    wetness,
  };
}

export interface RainSystem {
  group: THREE.Group;
  particles: THREE.Points;
  puddleMeshes: THREE.Mesh[];
  lastPuddle: number;
}

/** Build particles and puddle decals. Seed keeps placement deterministic. */
export function createRainSystem(seed = 0x2a17): RainSystem {
  const group = new THREE.Group();
  group.name = "rainSystem";
  const rng = mulberry32(seed);

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pos[i * 3] = (rng() - 0.5) * FIELD_HALF * 2;
    pos[i * 3 + 1] = rng() * FALL_RANGE + FALL_MIN;
    pos[i * 3 + 2] = (rng() - 0.5) * FIELD_HALF * 2;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xaac4ff,
    size: 0.35,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = "rainParticles";
  points.frustumCulled = false;
  group.add(points);

  const puddles: THREE.Mesh[] = [];
  for (let i = 0; i < PUDDLE_COUNT; i++) {
    const pg = new THREE.CircleGeometry(18 + rng() * 22, 12);
    const pm = new THREE.MeshStandardMaterial({
      color: 0x2a3a4a,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.0,
    });
    const m = new THREE.Mesh(pg, pm);
    m.rotation.x = -Math.PI / 2;
    m.position.set((rng() - 0.5) * 120, 0.05, (rng() - 0.5) * 120);
    m.visible = false;
    m.name = `puddle-${i}`;
    group.add(m);
    puddles.push(m);
  }
  return { group, particles: points, puddleMeshes: puddles, lastPuddle: 0 };
}

/**
 * Advance rain one frame. Drops wrap around the column deterministically
 * (no per-frame random), slant tilts on both axes, puddles grow/shrink.
 */
export function tickRain(sys: RainSystem, state: RainState, dt: number): void {
  const mat = sys.particles.material as THREE.PointsMaterial;
  const isRaining = state.intensity > RAIN_VISIBILITY;
  sys.group.visible = isRaining || state.puddleLevel > 0.05;
  mat.opacity = isRaining ? Math.min(0.65, state.intensity * 0.8) : 0;

  sys.particles.rotation.z = Math.atan2(state.slant.x, -state.slant.y) * 0.3;
  sys.particles.rotation.x = -Math.atan2(state.slant.z, -state.slant.y) * 0.3;

  if (isRaining) {
    const fall = 40 + state.intensity * 50;
    const pos = sys.particles.geometry.attributes["position"] as THREE.BufferAttribute;
    const top = FALL_MIN + FALL_RANGE;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - fall * dt;
      if (y < 0) y += top;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  for (const m of sys.puddleMeshes) {
    const pudMat = m.material as THREE.MeshStandardMaterial;
    pudMat.opacity = state.puddleLevel * 0.45;
    m.visible = state.puddleLevel > 0.08;
    const s = 0.7 + state.puddleLevel * 0.8;
    m.scale.set(s, s, 1);
  }
  sys.lastPuddle = state.puddleLevel;
}

export function isWetEnough(state: RainState, threshold = 0.15): boolean {
  return state.wetness > threshold || state.puddleLevel > threshold;
}

export function rainOpacity(state: RainState): number {
  return Math.min(0.65, state.intensity * 0.78);
}
