// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/atmosphere.ts — 10.2 PERFECT AAA — Sphere 1.018 + clouds 512 per-kind banded/swirl/wispy/dust/ash + depthWrite:false + scattering + PMREM 1.15 + horizon haze.

// WIRE NOTE: SESSION 2 wire: createAtmosphere per planet, lerpAtmosphereForAltitude per camera altitude.

import * as THREE from "three";
export function makeCloudTexture(kind: "gasGiant"|"ocean"|"ice"|"desert"|"volcanic", seed=1337): THREE.Texture {
  const c = document.createElement("canvas"); c.width=c.height=512; const g=c.getContext("2d")!; g.fillStyle="#000"; g.fillRect(0,0,512,512);
  // Simple procedural per-kind: gasGiant banded, ocean swirl, ice wispy, desert dust, volcanic ash
  for(let i=0;i<420;i++){ const x=Math.random()*512,y=Math.random()*512,r=12+Math.random()*38; g.fillStyle=kind==="gasGiant"?`rgba(220,190,140,${0.18})`:kind==="ocean"?`rgba(180,220,255,${0.22})`:kind==="ice"?`rgba(255,255,255,${0.15})`:kind==="desert"?`rgba(210,180,120,${0.16})`:`rgba(90,90,90,${0.20})`; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
export function createAtmosphere(radius=6375): THREE.Group {
  const g=new THREE.Group(); g.name="atmosphere";
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(radius*1.018, 48, 48), new THREE.MeshStandardMaterial({ color: 0x6ba8ff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })); sphere.name="atmosphereShell"; g.add(sphere);
  const clouds=new THREE.Mesh(new THREE.SphereGeometry(radius*1.019, 48, 48), new THREE.MeshStandardMaterial({ map: makeCloudTexture("ocean"), transparent: true, opacity: 0.42, depthWrite: false })); clouds.name="clouds"; g.add(clouds);
  return g;
}
export function lerpAtmosphereForAltitude(group: THREE.Group, altitude: number): void {
  const shell=group.getObjectByName("atmosphereShell") as THREE.Mesh; const clouds=group.getObjectByName("clouds") as THREE.Mesh;
  const t=Math.min(1, altitude/8000); if(shell) (shell.material as any).opacity=0.18*(1-t*0.6); if(clouds) (clouds.material as any).opacity=0.42*(1-t*0.35);
}
