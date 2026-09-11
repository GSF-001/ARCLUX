// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import * as THREE from "three";
import { createHeightmap, heightmapToGeometry } from "./terrain";
import { createOceanMesh, oceanDepthForHeightmap } from "./ocean";
import { disposeGroup } from "../bootstrap";

function toRegionId(c: { planetId: string; x: number; z: number }): string { return `${c.planetId}:${c.x}:${c.z}`; }

function lodForDistance(dist: number): number {
  if (dist < 4000) return 48;
  if (dist < 8000) return 32;
  if (dist < 15000) return 16;
  return 8;
}

export class ChunkManager {
  private active = new Set<string>();
  constructor(private chunkSize = 2000, private viewDist = 2) {}
  update(center: { x: number; z: number }): { toLoad: { planetId: string; x: number; z: number }[]; toUnload: string[] } {
    const cx = Math.floor(center.x / this.chunkSize), cz = Math.floor(center.z / this.chunkSize);
    const want = new Set<string>();
    const toLoad: { planetId: string; x: number; z: number }[] = [];
    for (let dx = -this.viewDist; dx <= this.viewDist; dx++) for (let dz = -this.viewDist; dz <= this.viewDist; dz++) {
      const k = { planetId: "planet-07", x: cx + dx, z: cz + dz };
      const id = toRegionId(k);
      want.add(id);
      if (!this.active.has(id)) { this.active.add(id); toLoad.push(k); }
    }
    const toUnload: string[] = [];
    for (const id of Array.from(this.active)) if (!want.has(id)) { this.active.delete(id); toUnload.push(id); }
    return { toLoad, toUnload };
  }
  has(id: string): boolean { return this.active.has(id); }
}

export function createChunkMesh(chunkId: string, lod = 16, seed = 0x07a1b2c3, chunkX = 0, chunkZ = 0): THREE.Group {
  const group = new THREE.Group();
  group.name = chunkId;
  const h = createHeightmap({ seed, size: 2000, lod, chunkX, chunkZ });
  const terrainGeom = heightmapToGeometry(h, lod, 2000);
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.04 });
  const terrain = new THREE.Mesh(terrainGeom, terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.name = `${chunkId}-terrain`;
  group.add(terrain);
  const depth = oceanDepthForHeightmap(h, 0);
  const hasOcean = depth.some(v => v < -1);
  if (hasOcean) {
    const oceanMesh = createOceanMesh({ size: 2000, seg: Math.max(8, lod / 2), windSpeed: 6, depthMap: depth });
    oceanMesh.name = `${chunkId}-ocean`;
    oceanMesh.position.y = -4;
    group.add(oceanMesh);
  }
  (group as any)._heightmap = h;
  (group as any)._lod = lod;
  return group;
}

export function updateChunks(manager: ChunkManager, center: { x: number; z: number }, scene: THREE.Scene, lodForDistFn: (d: number) => number = lodForDistance): void {
  const { toLoad, toUnload } = manager.update(center);
  for (const id of toUnload) {
    const o = scene.getObjectByName(id);
    // F5: unload WAJIB dispose — remove tanpa dispose = bocor GPU tiap travel.
    if (o) { scene.remove(o); disposeGroup(o as THREE.Group); }
  }
  for (const k of toLoad) {
    const id = toRegionId(k);
    const dist = Math.hypot(k.x * 2000 - center.x, k.z * 2000 - center.z);
    const lod = lodForDistFn(dist);
    const m = createChunkMesh(id, lod, 0x07a1b2c3, k.x, k.z);
    m.position.set(k.x * 2000, 0, k.z * 2000);
    scene.add(m);
  }
}

export { lodForDistance };
