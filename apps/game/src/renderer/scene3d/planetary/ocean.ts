// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import * as THREE from "three";

export interface OceanOpts {
  size: number;
  seg: number;
  windSpeed: number;
  depthMap?: Float32Array;
}

export function createOceanMesh(opts: OceanOpts = { size: 6000, seg: 64, windSpeed: 6 }): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(opts.size, opts.size, opts.seg, opts.seg);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a4a8a,
    transparent: true,
    opacity: 0.88,
    roughness: 0.22,
    metalness: 0.12,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  const colors: number[] = [];
  const pos = geom.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const depth = opts.depthMap ? opts.depthMap[i] : -40;
    const t = Math.max(0, Math.min(1, (-depth) / 80));
    const r = 0.08 + t * 0.06, g = 0.29 + t * 0.1, b = 0.54 + t * 0.16;
    colors.push(r, g, b);
  }
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -6;

  const g = 9.81;
  const waves = [
    { k: 0.018, amp: 3.5 + opts.windSpeed * 0.45, dirX: 1, dirZ: 0, omega: 0 },
    { k: 0.011, amp: 2.1 + opts.windSpeed * 0.22, dirX: 0.6, dirZ: 0.8, omega: 0 },
    { k: 0.032, amp: 0.9 + opts.windSpeed * 0.12, dirX: -0.7, dirZ: 0.5, omega: 0 },
    { k: 0.065, amp: 0.45, dirX: 0.2, dirZ: -0.9, omega: 0 },
  ];
  for (const w of waves) w.omega = Math.sqrt(g * w.k);

  let t = 0;
  const basePositions = new Float32Array(pos.array as ArrayLike<number>);

  (mesh as any)._tick = (dt: number, windDir = 0) => {
    t += dt;
    const p = geom.attributes.position as THREE.BufferAttribute;
    const col = geom.attributes.color as THREE.BufferAttribute;
    const cosD = Math.cos(windDir), sinD = Math.sin(windDir);
    for (let i = 0; i < p.count; i++) {
      const ox = basePositions[i * 3];
      const oz = basePositions[i * 3 + 1];
      let y = 0;
      let foamAcc = 0;
      for (let wi = 0; wi < waves.length; wi++) {
        const w = waves[wi];
        const wx = w.dirX * cosD - w.dirZ * sinD;
        const wz = w.dirX * sinD + w.dirZ * cosD;
        const phase = ox * w.k * wx + oz * w.k * wz - w.omega * t * (0.7 + wi * 0.15);
        const h = Math.sin(phase) * w.amp;
        y += h;
        if (wi < 2) foamAcc += Math.max(0, Math.cos(phase)) * w.amp * 0.12;
      }
      y += Math.sin(ox * 0.005 + t * 0.3) * 0.7;
      p.setZ(i, y);
      const depth = opts.depthMap ? opts.depthMap[i] : -40;
      const depthT = Math.max(0, Math.min(1, (-depth) / 80));
      const foam = Math.min(1, foamAcc * 0.18 + (y > 4 ? 0.25 : 0));
      const r = 0.08 + depthT * 0.06 + foam * 0.28;
      const g2 = 0.29 + depthT * 0.1 + foam * 0.32;
      const b = 0.54 + depthT * 0.16 + foam * 0.22;
      col.setXYZ(i, r, g2, b);
    }
    p.needsUpdate = true;
    col.needsUpdate = true;
    geom.computeVertexNormals();
  };

  return mesh;
}

export function oceanDepthForHeightmap(heightmap: Float32Array, seaLevel = 0): Float32Array {
  const d = new Float32Array(heightmap.length);
  for (let i = 0; i < heightmap.length; i++) d[i] = Math.min(0, heightmap[i] - seaLevel);
  return d;
}
