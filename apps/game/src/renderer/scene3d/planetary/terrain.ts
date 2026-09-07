// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import * as THREE from "three";
import { mulberry32 } from "../rng";

export interface TerrainOpts {
  seed: number;
  size: number;
  lod: number;
  chunkX: number;
  chunkZ: number;
}

export function hashPos(x: number, z: number, seed: number): number {
  const rnd = mulberry32(seed ^ (x * 374761393) ^ (z * 668265263));
  return rnd();
}

function fbm(x: number, z: number, seed: number): number {
  let v = 0;
  let a = 1;
  let f = 1;
  let max = 0;
  for (let i = 0; i < 4; i++) {
    v += (Math.sin(x * f * 0.8) * Math.cos(z * f * 0.7) + Math.sin(x * f * 1.3 + z * f * 0.9) * 0.5) * a;
    max += a;
    a *= 0.5;
    f *= 2.1;
  }
  const n = hashPos(Math.floor(x * 10), Math.floor(z * 10), seed);
  return v / max * 0.7 + (n - 0.5) * 0.3;
}

function hydraulicErode(h: Float32Array, n: number, iterations: number): void {
  for (let iter = 0; iter < iterations; iter++) {
    for (let z = 1; z < n - 1; z++) {
      for (let x = 1; x < n - 1; x++) {
        const i = z * n + x;
        const c = h[i];
        const l = h[i - 1], r = h[i + 1], u = h[i - n], d = h[i + n];
        const minN = Math.min(l, r, u, d);
        if (c > minN) {
          const diff = (c - minN) * 0.12;
          h[i] -= diff;
          if (l === minN) h[i - 1] += diff * 0.25;
          else if (r === minN) h[i + 1] += diff * 0.25;
          else if (u === minN) h[i - n] += diff * 0.25;
          else h[i + n] += diff * 0.25;
        }
      }
    }
  }
}

export function createHeightmap(opts: TerrainOpts): Float32Array {
  const rnd = mulberry32(opts.seed);
  const N = opts.lod + 1;
  const h = new Float32Array(N * N);
  const chunkOffX = opts.chunkX * opts.size;
  const chunkOffZ = opts.chunkZ * opts.size;
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const wx = (chunkOffX + (x / N) * opts.size) * 0.0003;
      const wz = (chunkOffZ + (z / N) * opts.size) * 0.0003;
      const continental = Math.sin(wx * 3) * Math.cos(wz * 3) * 180 + Math.sin(wx * 1.2) * Math.cos(wz * 0.9) * 80;
      const fbmVal = fbm(wx * 12, wz * 12, opts.seed);
      const mountainNoise = Math.pow(Math.abs(fbmVal), 1.8) * 420 * (0.6 + rnd() * 0.4);
      const ridge = (1 - Math.abs(Math.sin(wx * 6 + wz * 4))) * 60;
      const riverValley = Math.abs(Math.sin((wx + wz) * 8 + Math.cos(wx * 5) * 2)) * -35;
      const detail = (hashPos(x, z, opts.seed) - 0.5) * 12;
      const thermal = Math.sin(wx * 18) * Math.cos(wz * 18) * 6;
      h[z * N + x] = continental + mountainNoise + ridge + riverValley + detail + thermal;
    }
  }
  hydraulicErode(h, N, 2);
  return h;
}

export function heightmapToGeometry(h: Float32Array, lod: number, size: number): THREE.PlaneGeometry {
  const geom = new THREE.PlaneGeometry(size, size, lod, lod);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  let minH = Infinity, maxH = -Infinity;
  for (let i = 0; i < h.length; i++) {
    minH = Math.min(minH, h[i]);
    maxH = Math.max(maxH, h[i]);
  }
  for (let i = 0; i < pos.count; i++) {
    const height = h[i];
    pos.setZ(i, height);
    let r = 0.25, g = 0.18, b = 0.12;
    if (height > 320) { r = 0.96; g = 0.97; b = 0.98; }
    else if (height > 180) { const t = (height - 180) / 140; r = 0.52 + t * 0.18; g = 0.44 + t * 0.12; b = 0.36; }
    else if (height > 90) { const t = (height - 90) / 90; r = 0.42 + t * 0.1; g = 0.34 + t * 0.1; b = 0.28; }
    else if (height > 30) { const t = (height - 30) / 60; r = 0.33 + t * 0.12; g = 0.29 + t * 0.1; b = 0.19; }
    else if (height > -5) { r = 0.76; g = 0.62; b = 0.38; }
    else if (height > -25) { r = 0.62; g = 0.52; b = 0.36; }
    else { r = 0.48; g = 0.42; b = 0.32; }
    const slope = getSlopeAt(h, lod, i % (lod + 1), Math.floor(i / (lod + 1)));
    if (slope > 0.55) { r *= 0.92; g *= 0.9; b *= 0.88; }
    colors.push(r, g, b);
  }
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

export function getSlopeAt(h: Float32Array, lod: number, x: number, z: number): number {
  const N = lod + 1;
  const ix = Math.max(1, Math.min(N - 2, x));
  const iz = Math.max(1, Math.min(N - 2, z));
  const dzdx = (h[iz * N + ix + 1] - h[iz * N + ix - 1]) / 2;
  const dzdz = (h[(iz + 1) * N + ix] - h[(iz - 1) * N + ix]) / 2;
  return Math.sqrt(dzdx * dzdx + dzdz * dzdz) / 40;
}

export function getHeightAt(h: Float32Array, lod: number, size: number, wx: number, wz: number, chunkX: number, chunkZ: number): number {
  const N = lod + 1;
  const localX = (wx - chunkX * size) / size * lod;
  const localZ = (wz - chunkZ * size) / size * lod;
  const x0 = Math.floor(localX), z0 = Math.floor(localZ);
  const x1 = Math.min(N - 1, x0 + 1), z1 = Math.min(N - 1, z0 + 1);
  const fx = localX - x0, fz = localZ - z0;
  if (x0 < 0 || z0 < 0 || x0 >= N || z0 >= N) return 0;
  const h00 = h[z0 * N + x0], h10 = h[z0 * N + x1], h01 = h[z1 * N + x0], h11 = h[z1 * N + x1];
  const hx0 = h00 * (1 - fx) + h10 * fx;
  const hx1 = h01 * (1 - fx) + h11 * fx;
  return hx0 * (1 - fz) + hx1 * fz;
}

export function createTerrainMesh(seed: number, lod = 32, size = 4000, chunkX = 0, chunkZ = 0): THREE.Mesh {
  const h = createHeightmap({ seed, size, lod, chunkX, chunkZ });
  const geom = heightmapToGeometry(h, lod, size);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  (mesh as any)._heightmap = h;
  (mesh as any)._lod = lod;
  (mesh as any)._size = size;
  (mesh as any)._chunkX = chunkX;
  (mesh as any)._chunkZ = chunkZ;
  return mesh;
}
