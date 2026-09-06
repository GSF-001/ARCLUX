// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/terrain.ts - 10.2 terrain heightmap continental->mountain->biome->river, LOD 16-64, vertexColors, slope physics

import * as THREE from "three";
import { mulberry32 } from "../rng";
export interface TerrainOpts { seed: number; size: number; lod: number; chunkX: number; chunkZ: number; }
export function hashPos(x:number,z:number,seed:number): number {
  const rnd = mulberry32(seed ^ (x*374761393) ^ (z*668265263));
  return rnd();
}
// Continental: low freq 0.5, Mountain: pow 1.8, River: sin 8, Biome: temp/humidity
export function createHeightmap(opts: TerrainOpts): Float32Array {
  const rnd = mulberry32(opts.seed);
  const N = opts.lod + 1;
  const h = new Float32Array(N * N);
  const chunkOffX = opts.chunkX * opts.size;
  const chunkOffZ = opts.chunkZ * opts.size;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const wx = (chunkOffX + (x / N) * opts.size) * 0.0003;
    const wz = (chunkOffZ + (z / N) * opts.size) * 0.0003;
    const continental = Math.sin(wx * 3) * Math.cos(wz * 3) * 180 + Math.sin(wx*1.2)*80;
    const mountainNoise = Math.pow(Math.abs(Math.sin(wx * 12) * Math.cos(wz * 12) * Math.sin(wx*23)), 1.8) * 420 * (0.6 + rnd()*0.4);
    const ridge = (1 - Math.abs(Math.sin(wx*6 + wz*4))) * 60;
    const riverValley = Math.abs(Math.sin((wx + wz) * 8 + Math.cos(wx*5)*2)) * -35;
    const detail = (hashPos(x,z,opts.seed)-0.5)*12;
    h[z*N+x] = continental + mountainNoise + ridge + riverValley + detail;
  }
  return h;
}
export function heightmapToGeometry(h: Float32Array, lod: number, size: number): THREE.PlaneGeometry {
  const geom = new THREE.PlaneGeometry(size, size, lod, lod);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  let minH=Infinity, maxH=-Infinity;
  for(let i=0;i<h.length;i++){ minH=Math.min(minH,h[i]); maxH=Math.max(maxH,h[i]); }
  for (let i = 0; i < pos.count; i++) {
    const height = h[i];
    pos.setZ(i, height);
    // vertexColors: snow >300, rock >120, topsoil >30, clay >-20, sand
    let r=0.25,g=0.18,b=0.12;
    if (height > 300) { r=0.96; g=0.97; b=0.98; } // snow
    else if (height > 120) { const t=(height-120)/180; r=0.45+t*0.2; g=0.38+t*0.15; b=0.32; } // rock
    else if (height > 30) { const t=(height-30)/90; r=0.32+t*0.15; g=0.28+t*0.12; b=0.18; } // topsoil
    else if (height > -20) { r=0.76; g=0.62; b=0.38; } // sand
    else { r=0.55; g=0.45; b=0.3; } // clay wet
    colors.push(r,g,b);
  }
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  pos.needsUpdate = true; geom.computeVertexNormals();
  // physics slope per vertex for canBuildOnEmptyLand
  return geom;
}
export function getSlopeAt(h: Float32Array, lod: number, x:number, z:number): number {
  const N = lod+1;
  const ix = Math.max(1,Math.min(N-2, x)), iz = Math.max(1,Math.min(N-2, z));
  const dzdx = (h[iz*N+ix+1] - h[iz*N+ix-1])/2;
  const dzdz = (h[(iz+1)*N+ix] - h[(iz-1)*N+ix])/2;
  return Math.sqrt(dzdx*dzdx + dzdz*dzdz) / 40; // 0..1
}
export function createTerrainMesh(seed: number, lod = 32, size = 4000, chunkX=0, chunkZ=0): THREE.Mesh {
  const h = createHeightmap({ seed, size, lod, chunkX, chunkZ });
  const geom = heightmapToGeometry(h, lod, size);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI/2;
  (mesh as any)._heightmap = h; (mesh as any)._lod = lod;
  return mesh;
}
