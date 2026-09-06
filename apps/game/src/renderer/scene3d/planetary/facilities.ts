// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/facilities.ts - 10.5 facilities 10 types empty land, StationEntity health, clampCharacterSpeed

import * as THREE from "three";
import { threeColor } from "../../../ui/tokens";
import { colors } from "../../../ui/tokens";
export const FACILITIES = ["Landing Pad","Hangar","Repair","Refit","Radar","Comms","Military","Storage","Manufacturing","Spaceport"] as const;
export type FacilityKind = typeof FACILITIES[number];
export interface FacilityOpts { kind: FacilityKind; position: {x:number,y:number,z:number}; communityId?: string; }
// Empty land rule: !ocean && slope<0.3 && -5 < height < 300 && not forest dens
export function canBuildOnEmptyLand(height: number, slope: number, isOcean: boolean, forestDensity=0): boolean {
  return !isOcean && slope < 0.3 && height > -5 && height < 300 && forestDensity < 0.6;
}
export function isInEmptyLand(pos: {x:number,z:number}, heightmap: (x:number,z:number)=>number, slopeMap?: (x:number,z:number)=>number): boolean {
  const h = heightmap(pos.x, pos.z);
  const slope = slopeMap ? slopeMap(pos.x, pos.z) : 0.1;
  return canBuildOnEmptyLand(h, slope, h < -2);
}
// Per-kind mesh - different sizes, emissive for Spaceport/Radar
export function createFacilityMesh(kind: FacilityKind, opts: FacilityOpts): THREE.Group {
  const g = new THREE.Group(); g.name = `facility-${kind}`;
  let geom: THREE.BufferGeometry, mat: THREE.Material;
  switch(kind){
    case "Landing Pad": geom=new THREE.CylinderGeometry(28,28,2,32); mat=new THREE.MeshStandardMaterial({color: threeColor(colors.structHigh), roughness:0.85}); break;
    case "Hangar": geom=new THREE.BoxGeometry(60,24,80); mat=new THREE.MeshStandardMaterial({color: threeColor(colors.struct), metalness:0.7}); break;
    case "Radar": geom=new THREE.SphereGeometry(10,16,12); mat=new THREE.MeshStandardMaterial({color: threeColor(colors.tech), emissive: threeColor(colors.tech), emissiveIntensity:0.6}); break;
    case "Spaceport": geom=new THREE.TorusGeometry(22,3,12,32); mat=new THREE.MeshStandardMaterial({color: threeColor(colors.tactical), emissive: threeColor(colors.tactical), emissiveIntensity:0.4}); break;
    default: geom=new THREE.BoxGeometry(40,20,40); mat=new THREE.MeshStandardMaterial({color: 0x3a4a6a});
  }
  const mesh = new THREE.Mesh(geom, mat as any);
  if(kind==="Landing Pad") mesh.rotation.y=0; // pad flat
  mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
  g.add(mesh);
  // Health bar - StationEntity health 0..100
  const healthBar = new THREE.Mesh(new THREE.BoxGeometry(36,2,2), new THREE.MeshBasicMaterial({color: 0x5fe0a0}));
  healthBar.position.set(opts.position.x, opts.position.y+18, opts.position.z);
  healthBar.name="healthBar";
  g.add(healthBar);
  return g;
}
export function updateFacilityHealth(group: THREE.Group, health:number): void {
  const bar = group.getObjectByName("healthBar") as THREE.Mesh;
  if(bar){ const mat = bar.material as THREE.MeshBasicMaterial; mat.color.set(health>60?0x5fe0a0:health>30?0xf5a742:0xff5a5f); bar.scale.x = health/100; }
}
export function clampCharacterSpeed(vel:{x:number,y:number,z:number}):{x:number,y:number,z:number} {
  const speed = Math.hypot(vel.x, vel.z);
  if(speed > 5.5){ const s=5.5/speed; return {x:vel.x*s, y:vel.y, z:vel.z*s}; }
  return vel;
}
