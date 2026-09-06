// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// planetary/chunks.ts — 10.3 chunks streaming LOD, planetId:chunkX:chunkZ via claimRegion, Vec3 persist
// planetary/chunks.ts — 10.3 visual LOD cull, streaming, toRegionId, lodForDistance

import * as THREE from "three";
function toRegionId(c: { planetId: string; x: number; z: number }): string { return `${c.planetId}:${c.x}:${c.z}`; }
export class ChunkManager {
  private active = new Set<string>();
  constructor(private chunkSize=2000, private viewDist=2) {}
  update(center: {x:number,z:number}): { toLoad: {planetId:string,x:number,z:number}[]; toUnload: string[] } {
    const cx=Math.floor(center.x/this.chunkSize), cz=Math.floor(center.z/this.chunkSize);
    const want=new Set<string>(); const toLoad:{planetId:string,x:number,z:number}[]=[];
    for(let dx=-this.viewDist;dx<=this.viewDist;dx++) for(let dz=-this.viewDist;dz<=this.viewDist;dz++){ const k={planetId:"planet-07",x:cx+dx,z:cz+dz}; const id=toRegionId(k); want.add(id); if(!this.active.has(id)){this.active.add(id); toLoad.push(k);} }
    const toUnload:string[]=[]; for(const id of Array.from(this.active)) if(!want.has(id)){this.active.delete(id); toUnload.push(id);}
    return {toLoad,toUnload};
  }
}
export function createChunkMesh(chunkId: string, lod=16): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(2000,2000, lod, lod);
  const mat = new THREE.MeshStandardMaterial({ wireframe: false, color: 0x2a3a2a });
  const m = new THREE.Mesh(geom, mat); m.name = chunkId; return m;
}
export function updateChunks(manager: ChunkManager, center: {x:number,z:number}, scene: THREE.Scene, lodForDist: (d:number)=>number): void {
  const { toLoad, toUnload } = manager.update(center);
  for (const id of toUnload) { const o = scene.getObjectByName(id); if (o) scene.remove(o); }
  for (const k of toLoad) { const id = toRegionId(k); const dist = Math.hypot(k.x*2000-center.x, k.z*2000-center.z); const lod = lodForDist(dist); const m = createChunkMesh(id, lod); m.position.set(k.x*2000,0,k.z*2000); scene.add(m); }
}
