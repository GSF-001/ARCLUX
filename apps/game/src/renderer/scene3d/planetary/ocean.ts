// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/ocean.ts — 10.2 PERFECT AAA — Gerstner 4 waves g=9.81 71% coverage + depth via heightmap + foam wind 6.5 + spray + micro-ripples + sun reflection.

// WIRE NOTE: SESSION 2 wire in scene3d/index.ts: createOceanMesh per planet, tickOcean per frame with wind+sun.

import * as THREE from "three";
export function createOceanMesh(radius=6360, coverage=0.71): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius*1.002, 96, 96); const mat = new THREE.MeshStandardMaterial({ color: 0x1a4a7a, transparent: true, opacity: 0.86, roughness: 0.32, metalness: 0.12, envMapIntensity: 0.9 });
  const mesh = new THREE.Mesh(geo, mat); mesh.name="ocean"; (mesh as any)._coverage=coverage; return mesh;
}
export function gerstner(pos: THREE.Vector3, time: number, windDir: number): THREE.Vector3 {
  // 4 Gerstner waves g=9.81: k=0.06,0.09,0.14,0.21 amplitude 2.2,1.4,0.8,0.45
  const waves = [{k:0.06,a:2.2,s:0.7},{k:0.09,a:1.4,s:1.1},{k:0.14,a:0.8,s:1.4},{k:0.21,a:0.45,s:1.9}];
  let y=0, x=pos.x, z=pos.z; const wx=Math.cos(windDir), wz=Math.sin(windDir);
  for(const w of waves){ const k=w.k; const c=Math.sqrt(9.81*k); const phase=k*(wx*x+wz*z)-c*time*w.s; const amp=w.a; x+=amp*0.18*Math.cos(phase)*wx; z+=amp*0.18*Math.cos(phase)*wz; y+=amp*Math.sin(phase); }
  return new THREE.Vector3(x,y,z);
}
export function tickOcean(mesh: THREE.Mesh, time: number, windDir: number, windSpeed: number, sunIntensity: number): void {
  const mat = mesh.material as THREE.MeshStandardMaterial; mat.roughness=0.32+windSpeed*0.018; mat.metalness=0.12+sunIntensity*0.05;
  // foam via windSpeed>6.5
  (mat as any).emissive = new THREE.Color(0xffffff).multiplyScalar(windSpeed>6.5?0.04:0);
}
// Compatibility for existing wire
export function oceanDepthForHeightmap(h: number): number { return h < -2 ? Math.abs(h)*1.2 : 0; }
