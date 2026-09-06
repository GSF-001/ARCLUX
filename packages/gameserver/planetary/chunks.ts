// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/chunks.ts — 10.3 chunks streaming LOD, planetId:chunkX:chunkZ via claimRegion, Vec3 persist

// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
export interface ChunkKey { planetId: string; x: number; z: number; }
export function toRegionId(c: ChunkKey): string { return `${c.planetId}:${c.x}:${c.z}`; }
export function fromRegionId(id: string): ChunkKey | null {
  const parts = id.split(":");
  if (parts.length < 3) return null;
  const planetId = parts.slice(0, -2).join(":");
  const x = parseInt(parts[parts.length-2],10), z = parseInt(parts[parts.length-1],10);
  if (Number.isNaN(x) || Number.isNaN(z)) return null;
  return { planetId, x, z };
}
export function chunkFor(pos: {x:number,z:number}, chunkSize=2000): {x:number,z:number} {
  return { x: Math.floor(pos.x / chunkSize), z: Math.floor(pos.z / chunkSize) };
}
export function chunkWorldBounds(c: ChunkKey, chunkSize=2000): { min:{x:number,z:number}, max:{x:number,z:number} } {
  return { min: {x:c.x*chunkSize, z:c.z*chunkSize}, max: {x:(c.x+1)*chunkSize, z:(c.z+1)*chunkSize} };
}
export class ChunkManager {
  private active = new Map<string, ChunkKey>();
  private lastCenter: {x:number,z:number} | null = null;
  constructor(private chunkSize=2000, private viewDist=2) {}
  update(center: {x:number,z:number}, planetId="planet-07"): { toLoad: ChunkKey[]; toUnload: string[]; active: string[] } {
    const c = chunkFor(center, this.chunkSize);
    if (this.lastCenter && chunkFor(this.lastCenter, this.chunkSize).x===c.x && chunkFor(this.lastCenter, this.chunkSize).z===c.z) {
      return { toLoad: [], toUnload: [], active: Array.from(this.active.keys()) };
    }
    this.lastCenter = { ...center };
    const want = new Map<string, ChunkKey>();
    const toLoad: ChunkKey[] = [];
    for (let dx=-this.viewDist; dx<=this.viewDist; dx++) for(let dz=-this.viewDist; dz<=this.viewDist; dz++) {
      const k: ChunkKey = { planetId, x: c.x+dx, z: c.z+dz };
      const id = toRegionId(k);
      want.set(id, k);
      if (!this.active.has(id)) { this.active.set(id, k); toLoad.push(k); }
    }
    const toUnload: string[] = [];
    for (const id of Array.from(this.active.keys())) if (!want.has(id)) { this.active.delete(id); toUnload.push(id); }
    return { toLoad, toUnload, active: Array.from(this.active.keys()) };
  }
  isActive(id:string):boolean{ return this.active.has(id); }
  getActive():ChunkKey[]{ return Array.from(this.active.values()); }
}
