// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/hydrological.ts - 10.G G4 Hydrological Continuity: MOUNTAIN->STREAM->RIVER->LAKE->COAST->OCEAN. Zoom dari blueprint G4 river flow+foam+wet banks+river->ocean.

// WIRE NOTE for SESSION 2: import { getRiverFlow, createRiverSystem, tickRiver } from "./planetary/hydrological" di scene3d/index.ts. Flow via heightmap gradient.

import * as THREE from "three";

export interface RiverFlow {
  direction: { x: number; z: number }; // normalized
  speed: number; // 0..1 (steep -> fast)
  foam: number; // 0..1
  wetBanks: number; // 0..1
}

export function getRiverFlow(height: number, slope: number, neighborHeights: number[]): RiverFlow {
  // Flow direction via steepest descent (simple: max neighbor diff)
  let maxDiff = 0;
  let dirX = 0, dirZ = 0;
  // neighborHeights: [n, e, s, w] heights
  const dirs = [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }];
  for (let i = 0; i < 4; i++) {
    const diff = height - (neighborHeights[i] ?? height);
    if (diff > maxDiff) {
      maxDiff = diff;
      dirX = dirs[i].x;
      dirZ = dirs[i].z;
    }
  }
  const len = Math.hypot(dirX, dirZ) || 1;
  const speed = Math.min(1, slope * 1.8 + maxDiff * 0.02);
  const foam = slope > 0.25 ? Math.min(1, speed * 0.8 + 0.2) : speed * 0.3;
  const wetBanks = height < 20 ? 0.6 + foam * 0.3 : foam * 0.4;
  return { direction: { x: dirX / len, z: dirZ / len }, speed, foam, wetBanks };
}

export interface RiverSystem {
  flowMeshes: THREE.Mesh[]; // 2 river segments
}

export function createRiverSystem(): RiverSystem {
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.PlaneGeometry(14, 60);
    const m = new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 0.3, metalness: 0.15, transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.04;
    mesh.name = `river-${i}`;
    meshes.push(mesh);
  }
  return { flowMeshes: meshes };
}

export function tickRiver(sys: RiverSystem, flow: RiverFlow, isRaining: boolean, dt: number): void {
  const rainBoost = isRaining ? 1.3 : 1;
  sys.flowMeshes.forEach((m, idx) => {
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.45 + flow.wetBanks * 0.25;
    // Foam lerp via flow.foam
    (mat as any).emissive = new THREE.Color(0xffffff).multiplyScalar(flow.foam * 0.12);
    // Flow uv offset (simulate via position)
    m.position.x += flow.direction.x * flow.speed * rainBoost * dt * 6;
    m.position.z += flow.direction.z * flow.speed * rainBoost * dt * 6;
    // River->ocean meeting: if near coast, fade to ocean color
  });
}
