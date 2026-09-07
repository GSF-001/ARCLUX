// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/vegetation.ts - 10.X.3 vegetation resolver.
// Five growth stages (grass through tree) sway out of phase in gusts and
// turbulence and darken while wet. Placement is deterministic from the seed
// so chunks regenerate identically after handoff or reconnect.
// Visual-only: reads EnvironmentalContext wind and precipitation.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type VegetationKind = "grass" | "small" | "bush" | "branch" | "tree";

const COUNTS: Record<VegetationKind, number> = { grass: 80, small: 24, bush: 12, branch: 8, tree: 4 };
const TOTAL = 80 + 24 + 12 + 8 + 4;
const FIELD_HALF = 100;
const WET_TINT = 0x1a2a1a;
const WET_DARKEN = 0.12;

export interface VegetationInstance {
  kind: VegetationKind;
  mesh: THREE.Object3D;
  basePos: THREE.Vector3;
  baseColor: THREE.Color;
  phase: number; // 0..1 deterministic offset
}

export interface VegetationSystem {
  group: THREE.Group;
  instances: VegetationInstance[];
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

const _wetColor = new THREE.Color(WET_TINT);
const _tintScratch = new THREE.Color();

function kindSwayFactor(kind: VegetationKind): number {
  if (kind === "grass") return 2.0;
  if (kind === "small") return 1.6;
  if (kind === "bush") return 1.2;
  if (kind === "branch") return 0.7;
  return 0.4;
}

function buildMesh(kind: VegetationKind): { mesh: THREE.Mesh; color: number } {
  if (kind === "grass") {
    const g = new THREE.PlaneGeometry(0.4, 0.8);
    const m = new THREE.MeshBasicMaterial({ color: 0x2f6b4a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    return { mesh: new THREE.Mesh(g, m), color: 0x2f6b4a };
  }
  if (kind === "small") {
    const g = new THREE.SphereGeometry(0.6, 6, 6);
    const m = new THREE.MeshStandardMaterial({ color: 0x3a7a4a });
    return { mesh: new THREE.Mesh(g, m), color: 0x3a7a4a };
  }
  if (kind === "bush") {
    const g = new THREE.SphereGeometry(1.2, 8, 8);
    const m = new THREE.MeshStandardMaterial({ color: 0x2e5a3a });
    return { mesh: new THREE.Mesh(g, m), color: 0x2e5a3a };
  }
  if (kind === "branch") {
    const g = new THREE.CylinderGeometry(0.12, 0.18, 2.5, 6);
    const m = new THREE.MeshStandardMaterial({ color: 0x4a3a2a });
    return { mesh: new THREE.Mesh(g, m), color: 0x4a3a2a };
  }
  const g = new THREE.CylinderGeometry(0.35, 0.5, 6, 8);
  const m = new THREE.MeshStandardMaterial({ color: 0x3d2f24 });
  return { mesh: new THREE.Mesh(g, m), color: 0x3d2f24 };
}

/** Build the pooled instances. Seed keeps chunk regeneration identical. */
export function createVegetationSystem(seed = 0xe9e7): VegetationSystem {
  const group = new THREE.Group();
  group.name = "vegetationSystem";
  const instances: VegetationInstance[] = [];
  const rng = mulberry32(seed);
  for (const kind of Object.keys(COUNTS) as VegetationKind[]) {
    for (let i = 0; i < COUNTS[kind]; i++) {
      const { mesh, color } = buildMesh(kind);
      mesh.position.set((rng() - 0.5) * FIELD_HALF * 2, 0, (rng() - 0.5) * FIELD_HALF * 2);
      mesh.name = `veg-${kind}-${i}`;
      group.add(mesh);
      instances.push({
        kind,
        mesh,
        basePos: mesh.position.clone(),
        baseColor: new THREE.Color(color),
        phase: rng(),
      });
    }
  }
  return { group, instances };
}

/**
 * Advance vegetation one frame.
 * @param timeSec deterministic clock (worldTime/1000 + tick * dt)
 * Small stages respond fast and wide to gusts; trees respond slow and narrow.
 * Wetness tints from the stored base color every frame, so drying restores
 * the original color instead of accumulating darkness.
 */
export function tickVegetation(
  sys: VegetationSystem,
  ctx: EnvironmentalContext,
  dt: number,
  timeSec: number,
): void {
  void dt;
  const wind = ctx.wind;
  const rainWet = ctx.weather.precipitationIntensity;
  const gust = wind.gustStrength;
  const turb = wind.turbulence;
  const spread = 0.7 + wind.localVariation * 0.6;
  const wet = rainWet > 0.1 ? Math.min(1, rainWet) * WET_DARKEN : 0;

  for (const inst of sys.instances) {
    const factor = kindSwayFactor(inst.kind);
    const gustPhase = Math.sin(timeSec * 2 * factor + inst.phase * Math.PI * 2 + wind.direction) * gust;
    const turbPhase = Math.sin(timeSec + inst.phase * 6) * turb * 0.5;
    const sway = (gustPhase * 0.4 + turbPhase * 0.15) * wind.speed * 0.04 * factor * spread;

    if (inst.kind === "grass" || inst.kind === "small") {
      inst.mesh.rotation.z = sway;
      inst.mesh.rotation.x = sway * 0.5;
    } else {
      inst.mesh.position.x = inst.basePos.x + Math.cos(wind.direction) * sway * 2;
      inst.mesh.position.z = inst.basePos.z + Math.sin(wind.direction) * sway * 2;
    }

    if (inst.mesh instanceof THREE.Mesh) {
      const mat = inst.mesh.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
      _tintScratch.copy(inst.baseColor);
      if (wet > 0) _tintScratch.lerp(_wetColor, wet);
      mat.color.copy(_tintScratch);
    }
  }
}

/** Hide instances beyond maxDist from center. Returns the hidden count. */
export function cullVegetationByDistance(
  sys: VegetationSystem,
  maxDist: number,
  center: { x: number; z: number },
): number {
  let culled = 0;
  for (const inst of sys.instances) {
    const d = Math.hypot(inst.basePos.x - center.x, inst.basePos.z - center.z);
    const show = d < maxDist;
    inst.mesh.visible = show;
    if (!show) culled++;
  }
  return culled;
}

/** Active instance budget per quality level (total pool is 128). */
export function vegetationBudgetForQuality(level: string): number {
  if (level === "CINEMATIC") return TOTAL;
  if (level === "NEAR") return 64;
  if (level === "MEDIUM") return 24;
  return 8;
}
