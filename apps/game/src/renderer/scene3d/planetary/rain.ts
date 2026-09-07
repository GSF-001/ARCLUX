// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/rain.ts - 10.X.2 Rain + rain-surface/ocean: wet/puddles/runoff/reflection + micro-ripples. Zoom dari blueprint "RainState { intensity, direction, wind, droplet density } -> slant, splash, wet, puddles, runoff, ocean ripples".

// WIRE NOTE for SESSION 2: import { createRainSystem, tickRain } from "./planetary/rain" di scene3d/index.ts. Create sekali, tick tiap frame dengan EnvironmentalContext + dt + terrain height.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export interface RainState {
  intensity: number; // 0..1
  slant: THREE.Vector3; // direction + wind
  dropletDensity: number; // per m3
  puddleLevel: number; // 0..1 (accumulated)
  wetness: number; // 0..1
}

export function deriveRainState(ctx: EnvironmentalContext, dt: number, accPuddle: number): RainState {
  const intensity = ctx.weather.precipitationIntensity * (ctx.weather.kind === "storm" ? 1 : ctx.weather.kind === "rain" ? 0.7 : 0);
  const wind = ctx.wind;
  // Slant: wind direction + speed 2..10 -> slant 0..0.6
  const slantX = Math.cos(wind.direction) * wind.speed * 0.06;
  const slantZ = Math.sin(wind.direction) * wind.speed * 0.06;
  const slant = new THREE.Vector3(slantX, -1, slantZ).normalize();
  // Puddle accumulation: rain 0.8 -> +0.02 per sec, dry -> -0.01 per sec (draining)
  let puddle = accPuddle;
  if (intensity > 0.1) puddle = Math.min(1, puddle + intensity * dt * 0.025);
  else puddle = Math.max(0, puddle - dt * 0.015);
  const wetness = Math.min(1, intensity * 0.9 + puddle * 0.4);
  return { intensity, slant, dropletDensity: intensity * 800, puddleLevel: puddle, wetness };
}

export interface RainSystem {
  group: THREE.Group;
  particles: THREE.Points;
  puddleMeshes: THREE.Mesh[]; // 3 puddle decals
  lastPuddle: number;
}

export function createRainSystem(): RainSystem {
  const group = new THREE.Group();
  group.name = "rainSystem";
  const geo = new THREE.BufferGeometry();
  const count = 2000;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 600;
    pos[i * 3 + 1] = Math.random() * 200 + 20;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 600;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xaac4ff, size: 0.35, transparent: true, opacity: 0.0, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.name = "rainParticles";
  group.add(points);
  // Puddle decals — 3 quads di tanah
  const puddles: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const pg = new THREE.CircleGeometry(18 + Math.random() * 22, 12);
    const pm = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.0 });
    const m = new THREE.Mesh(pg, pm);
    m.rotation.x = -Math.PI / 2;
    m.position.set((Math.random() - 0.5) * 120, 0.05, (Math.random() - 0.5) * 120);
    m.visible = false;
    m.name = `puddle-${i}`;
    group.add(m);
    puddles.push(m);
  }
  return { group, particles: points, puddleMeshes: puddles, lastPuddle: 0 };
}

export function tickRain(sys: RainSystem, state: RainState, dt: number): void {
  const mat = sys.particles.material as THREE.PointsMaterial;
  // Visibility + intensity -> opacity + count via size?
  const isRaining = state.intensity > 0.08;
  sys.group.visible = isRaining || state.puddleLevel > 0.05;
  mat.opacity = isRaining ? Math.min(0.65, state.intensity * 0.8) : 0;
  // Slant -> rotate particles group
  sys.particles.rotation.z = Math.atan2(state.slant.x, -state.slant.y) * 0.3;
  // Fall speed via intensity: 40..90 units/s
  const fall = 40 + state.intensity * 50;
  const pos = sys.particles.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) - fall * dt;
    if (y < 0) y = 200 + Math.random() * 20;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
  // Puddles: puddleLevel 0..1 -> opacity + scale
  sys.puddleMeshes.forEach((m) => {
    const pudMat = m.material as THREE.MeshStandardMaterial;
    const target = state.puddleLevel;
    pudMat.opacity = target * 0.45;
    m.visible = target > 0.08;
    const s = 0.7 + target * 0.8;
    m.scale.set(s, s, 1);
  });
  sys.lastPuddle = state.puddleLevel;
  // Ocean ripples hint: SESSION 2 bisa baca state.intensity untuk ocean.ts micro-ripples
}

export function isWetEnough(state: RainState, threshold = 0.15): boolean {
  return state.wetness > threshold || state.puddleLevel > threshold;
}

export function rainOpacity(state: RainState): number {
  return Math.min(0.65, state.intensity * 0.78);
}

