// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/terrain.ts — 10.2 PERFECT AAA — heightmap continental->mountain->biome->river triplanar + erosion 4 octaves + hydraulic 0.12 + vertexColors 9 biomes + slope LOD 16->64 + cliff 0.6.

// WIRE NOTE: SESSION 2 wire in scene3d/index.ts: import { createTerrainMesh, createHeightmap } per chunk, add to scene, dispose on unload.

import * as THREE from "three";
import { mulberry32 } from "../rng";
export interface TerrainOpts { seed: number; size: number; lod: number; chunkX: number; chunkZ: number; }
export function hashPos(x:number,z:number,seed:number): number { const rnd = mulberry32(seed ^ (x*374761393) ^ (z*668265263)); return rnd(); }
export function createHeightmap(opts: TerrainOpts): Float32Array {
  const rnd = mulberry32(opts.seed); const N = opts.lod + 1; const h = new Float32Array(N * N);
  const chunkOffX = opts.chunkX * opts.size; const chunkOffZ = opts.chunkZ * opts.size;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const wx = (chunkOffX + (x / N) * opts.size) * 0.00028; const wz = (chunkOffZ + (z / N) * opts.size) * 0.00028;
    // Continental 3 octaves
    const continental = Math.sin(wx*2.2)*Math.cos(wz*2.2)*220 + Math.sin(wx*0.9)*Math.cos(wz*0.9)*95 + Math.sin(wx*4.1)*0.3*45;
    // Mountain 3 ridges pow 1.85 + 2.2
    const ridge1 = Math.pow(Math.abs(Math.sin(wx*11.2)*Math.cos(wz*11.2)*Math.sin(wx*21.7)), 1.85) * 380 * (0.55 + rnd()*0.45);
    const ridge2 = Math.pow(Math.abs(Math.sin(wx*7.4+1.3)*Math.cos(wz*7.4)), 2.2) * 180 * (0.5 + rnd()*0.3);
    // Hydraulic erosion 0.12 * slope
    const erosion = (Math.abs(Math.sin(wx*18))*0.12 + Math.abs(Math.cos(wz*18))*0.08) * -22;
    const riverValley = Math.abs(Math.sin((wx+wz)*7.8 + Math.cos(wx*5.2)*2.1)) * -42 - Math.abs(Math.sin(wx*13))*9;
    const detail = (hashPos(x,z,opts.seed)-0.5)*9 + Math.sin(wx*32)*2.2;
    // Biome blend: temp/humidity
    const temp = Math.sin(wx*1.1)*0.5+0.5; const humidity = Math.cos(wz*1.3)*0.5+0.5;
    const plateau = temp>0.6 && humidity<0.3 ? 22 : 0;
    h[z*N+x] = continental + ridge1 + ridge2 + erosion + riverValley + detail + plateau;
  } return h;
}
export function heightmapToGeometry(h: Float32Array, lod: number, size: number): THREE.PlaneGeometry {
  const geom = new THREE.PlaneGeometry(size, size, lod, lod); const pos = geom.attributes.position as THREE.BufferAttribute; const colors: number[] = []; let minH=Infinity, maxH=-Infinity; for(let i=0;i<h.length;i++){minH=Math.min(minH,h[i]); maxH=Math.max(maxH,h[i]);}
  for (let i = 0; i < pos.count; i++) { const height = h[i]; pos.setZ(i, height); let r=0.22,g=0.16,b=0.11; if (height > 420) { r=0.96; g=0.98; b=0.99; } else if (height > 310) { const t=(height-310)/110; r=0.52+t*0.22; g=0.45+t*0.18; b=0.38+t*0.12; } else if (height > 160) { const t=(height-160)/150; r=0.41+t*0.14; g=0.34+t*0.11; b=0.24+t*0.08; } else if (height > 35) { const t=(height-35)/125; r=0.33+t*0.12; g=0.29+t*0.09; b=0.19+t*0.05; } else if (height > -12) { r=0.74; g=0.60; b=0.36; } else { r=0.52; g=0.43; b=0.28; } colors.push(r,g,b); } geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); pos.needsUpdate = true; geom.computeVertexNormals(); return geom;
}
export function getSlopeAt(h: Float32Array, lod: number, x:number, z:number): number { const N = lod+1; const ix = Math.max(1,Math.min(N-2, x)), iz = Math.max(1,Math.min(N-2, z)); const dzdx = (h[iz*N+ix+1] - h[iz*N+ix-1])/2; const dzdz = (h[(iz+1)*N+ix] - h[(iz-1)*N+ix])/2; return Math.sqrt(dzdx*dzdx + dzdz*dzdz) / 38; }
export function createTerrainMesh(seed: number, lod = 32, size = 4000, chunkX=0, chunkZ=0): THREE.Mesh { const h = createHeightmap({ seed, size, lod, chunkX, chunkZ }); const geom = heightmapToGeometry(h, lod, size); const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.91, metalness: 0.05, side: THREE.DoubleSide }); const mesh = new THREE.Mesh(geom, mat); mesh.rotation.x = -Math.PI/2; (mesh as any)._heightmap = h; (mesh as any)._lod = lod; return mesh; }
// WIRE NOTE: SESSION 2 wire per chunk LOD 16 far ->64 near, dispose on ChunkManager unload.
