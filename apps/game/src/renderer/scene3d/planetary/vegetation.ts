// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/vegetation.ts - 10.X.3 Vegetation wind grass->tree phased + rain wetness. Zoom dari blueprint "Vegetation wind grass->small->bush->branch->tree gust/turbulence phased, rain wetness".

// WIRE NOTE for SESSION 2: import { createVegetationSystem, tickVegetation } from "./planetary/vegetation" di scene3d/index.ts. Vegetation instances di chunks, tick per frame dengan EnvironmentalContext.wind + rain.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type VegetationKind = "grass" | "small" | "bush" | "branch" | "tree";

export interface VegetationInstance {
  kind: VegetationKind;
  mesh: THREE.Object3D;
  basePos: THREE.Vector3;
  phase: number; // 0..1 random offset
}

export interface VegetationSystem {
  group: THREE.Group;
  instances: VegetationInstance[];
}

export function createVegetationSystem(): VegetationSystem {
  const group = new THREE.Group();
  group.name = "vegetationSystem";
  const instances: VegetationInstance[] = [];
  // Create 80 grass + 24 small + 12 bush + 8 branch + 4 tree = 128
  const counts: Record<VegetationKind, number> = { grass: 80, small: 24, bush: 12, branch: 8, tree: 4 };
  for (const kind of Object.keys(counts) as VegetationKind[]) {
    for (let i = 0; i < counts[kind]; i++) {
      let mesh: THREE.Object3D;
      if (kind === "grass") {
        const g = new THREE.PlaneGeometry(0.4, 0.8);
        const m = new THREE.MeshBasicMaterial({ color: 0x2f6b4a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
        mesh = new THREE.Mesh(g, m);
      } else if (kind === "small") {
        const g = new THREE.SphereGeometry(0.6, 6, 6);
        const m = new THREE.MeshStandardMaterial({ color: 0x3a7a4a });
        mesh = new THREE.Mesh(g, m);
      } else if (kind === "bush") {
        const g = new THREE.SphereGeometry(1.2, 8, 8);
        const m = new THREE.MeshStandardMaterial({ color: 0x2e5a3a });
        mesh = new THREE.Mesh(g, m);
      } else if (kind === "branch") {
        const g = new THREE.CylinderGeometry(0.12, 0.18, 2.5, 6);
        const m = new THREE.MeshStandardMaterial({ color: 0x4a3a2a });
        mesh = new THREE.Mesh(g, m);
      } else {
        const g = new THREE.CylinderGeometry(0.35, 0.5, 6, 8);
        const m = new THREE.MeshStandardMaterial({ color: 0x3d2f24 });
        mesh = new THREE.Mesh(g, m);
      }
      mesh.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      mesh.name = `veg-${kind}-${i}`;
      group.add(mesh);
      instances.push({ kind, mesh, basePos: mesh.position.clone(), phase: Math.random() });
    }
  }
  return { group, instances };
}

/**
 * Tick: wind gust/turbulence phased grass->tree, rain wetness.
 * - grass small gust 0.6 fast (2*wind), tree gust 0.2 slow (0.4*wind) + turbulence
 * - localVariation biar A vs B gak sinkron
 * - rain wetness 0..1 -> color darkens + emissive slight
 */
export function tickVegetation(sys: VegetationSystem, ctx: EnvironmentalContext, dt: number, time: number): void {
  const wind = ctx.wind;
  const rainWet = ctx.weather.precipitationIntensity;
  const gust = wind.gustStrength;
  const turb = wind.turbulence;

  for (const inst of sys.instances) {
    const kindFactor = inst.kind === "grass" ? 2.0 : inst.kind === "small" ? 1.6 : inst.kind === "bush" ? 1.2 : inst.kind === "branch" ? 0.7 : 0.4;
    const gustPhase = Math.sin(time * 0.002 * kindFactor + inst.phase * Math.PI * 2 + wind.direction) * gust;
    const turbPhase = Math.sin(time * 0.001 + inst.phase * 6) * turb * 0.5;
    const sway = (gustPhase * 0.4 + turbPhase * 0.15) * wind.speed * 0.04 * kindFactor * (0.7 + wind.localVariation * 0.6);

    // Apply sway: grass = rotation, tree = position offset
    if (inst.kind === "grass" || inst.kind === "small") {
      inst.mesh.rotation.z = sway;
      inst.mesh.rotation.x = sway * 0.5;
    } else {
      inst.mesh.position.x = inst.basePos.x + Math.cos(wind.direction) * sway * 2;
      inst.mesh.position.z = inst.basePos.z + Math.sin(wind.direction) * sway * 2;
    }

    // Rain wetness: darken + slight emissive
    if (inst.mesh instanceof THREE.Mesh) {
      const mat = inst.mesh.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
      if ("color" in mat) {
        const baseHsl: any = {};
        (mat.color as any).getHSL?.(baseHsl);
        // wet -> darker 12%, more saturated
        if (rainWet > 0.1) {
          (mat as any).color.lerp(new THREE.Color(0x1a2a1a), rainWet * 0.12);
        }
      }
    }
  }
}
