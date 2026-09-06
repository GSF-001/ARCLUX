// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/surface.ts — 10.4 lerp SPACE→SURFACE, 24h lunar Kepler, GateLink 800m

import * as THREE from "three";
export type TimeOfDay = "dawn"|"day"|"dusk"|"night";
export function timeOfDayFromMs(ms:number): TimeOfDay {
  const h = (ms % 86400000) / 3600000;
  if (h < 5 || h > 19) return "night";
  if (h < 7) return "dawn";
  if (h > 17) return "dusk";
  return "day";
}
export function sunDirectionFromTime(ms:number, planetSeed:number): THREE.Vector3 {
  const t = (ms % 86400000) / 86400000;
  const ang = t * Math.PI * 2 + (planetSeed % 1000)*0.001;
  return new THREE.Vector3(Math.cos(ang), Math.sin(ang)*0.6, 0.2).normalize();
}
export function lerpSpaceToSurface(t:number, clouds:THREE.Group, terrain:THREE.Group, atmosphere:THREE.Group): void {
  // t 0=space, 0.3=orbit, 0.6=atmosphere, 1=surface
  const cloudOpacity = t < 0.3 ? 0 : t < 0.7 ? (t-0.3)/0.4 : 1 - (t-0.7)/0.3*0.2;
  clouds.visible = t > 0.2 && t < 0.85;
  clouds.traverse((o:any)=>{ if(o.material) o.material.opacity = cloudOpacity; });
  terrain.visible = t > 0.35;
  atmosphere.visible = t > 0.15;
  // haze lerp
  const haze = atmosphere.getObjectByName("haze") as THREE.Mesh;
  if(haze) (haze.material as THREE.MeshBasicMaterial).opacity = 0.06 * (1 - t*0.7);
}
export function canAutoLand(distToPad:number, speed:number): boolean {
  return distToPad < 800 && speed < 25; // GateLink 800m auto ACK
}
export function raycastCrash(altitude:number, verticalSpeed:number): boolean {
  return altitude < 12 && Math.abs(verticalSpeed) > 18; // KE crash
}
