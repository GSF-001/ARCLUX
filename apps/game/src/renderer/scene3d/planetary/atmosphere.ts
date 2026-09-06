// Copyright 2026 GSF-001
// 10.2 atmosphere — Sphere 1.018 + clouds 512 per-kind, depthWrite:false, scattering, PMREM reuse
import * as THREE from "three";
import { makeCloudTexture } from "../planets";
import type { PlanetKind } from "../planets";
export function createAtmosphere(radius: number, kind: PlanetKind): THREE.Group {
  const g = new THREE.Group();
  g.name = `atmosphere-${kind}`;
  // Rayleigh scattering shell — subtle blue, BackSide
  const atmoMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.14, depthWrite: false, side: THREE.BackSide, color: 0x87ceeb, emissive: 0x87ceeb, emissiveIntensity: 0.12 });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.018, 32, 32), atmoMat);
  g.add(atmo);
  // Cloud shell — per-kind texture, depthWrite:false so terrain not z-fighting, double side for interior view
  const cloudTex = makeCloudTexture(kind, 512);
  cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
  const cloudMat = new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, opacity: 0.42, depthWrite: false, roughness: 1, metalness: 0 });
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.022, 32, 32), cloudMat);
  cloud.name = "clouds";
  g.add(cloud);
  // Inner haze — for atmospheric entry lerp
  const hazeMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.BackSide });
  const haze = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.035, 16, 16), hazeMat);
  haze.name = "haze";
  g.add(haze);
  // Tick: cloud drift speed per kind (reuse WindState direction later)
  (g as any)._tick = (dt:number, windSpeed=2) => { cloud.rotation.y += dt * 0.00042 * (1 + windSpeed*0.08); };
  return g;
}
export function lerpAtmosphereForAltitude(group: THREE.Group, altitude:number): void {
  // altitude 0=surface, 1=space — lerp opacity
  const atmo = group.getObjectByName("clouds") as THREE.Mesh;
  if (atmo) (atmo.material as THREE.MeshStandardMaterial).opacity = 0.42 * (1 - altitude*0.5);
}
