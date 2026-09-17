// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import * as THREE from "three";
import { makeCloudTexture } from "../planets";
import type { PlanetKind } from "../planets";

export function createAtmosphere(radius: number, kind: PlanetKind): THREE.Group {
  const g = new THREE.Group();
  g.name = `atmosphere-${kind}`;

  const scatterColor = kind === "desert" ? 0xd9a86c : kind === "ice" ? 0xcfe9ff : kind === "volcanic" ? 0x8a3a2a : 0x87ceeb;
  const atmoMat = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    side: THREE.BackSide,
    color: scatterColor,
    emissive: scatterColor,
    emissiveIntensity: 0.1,
    roughness: 1,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.018, 32, 32), atmoMat);
  atmo.name = "atmoShell";
  g.add(atmo);

  const cloudTex = makeCloudTexture(kind, 512);
  cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
  cloudTex.repeat.set(2, 1);
  const cloudMat = new THREE.MeshStandardMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    roughness: 1,
    metalness: 0,
  });
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.022, 32, 32), cloudMat);
  cloud.name = "clouds";
  g.add(cloud);

  const hazeMat = new THREE.MeshBasicMaterial({
    color: scatterColor,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const haze = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.035, 16, 16), hazeMat);
  haze.name = "haze";
  g.add(haze);

  const mieMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.015,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const mie = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, 24, 24), mieMat);
  mie.name = "mie";
  g.add(mie);

  (g as any)._tick = (dt: number, windSpeed = 2, sunElevation = 0.5) => {
    cloud.rotation.y += dt * 0.00042 * (1 + windSpeed * 0.08);
    haze.rotation.y += dt * 0.00018;
    // A4 — Sunset ramp: 3-stop color shift based on sun elevation
    // noon (elev>0.5) = blue, sunset (0..0.5) = orange→red, night (<0) = dark blue
    const cloudMat = cloud.material as THREE.MeshStandardMaterial;
    if (sunElevation > 0.5) {
      // Day — neutral
      cloudMat.emissive.setHex(0x000000);
      cloudMat.emissiveIntensity = 0;
    } else if (sunElevation > 0) {
      // Sunset — warm edge-lit clouds
      const t = sunElevation / 0.5;
      const r = 1, g = 0.5 + t * 0.3, b = 0.2 + t * 0.6;
      cloudMat.emissive.setRGB(r * (1 - t) * 0.3, g * (1 - t) * 0.2, b * (1 - t) * 0.15);
      cloudMat.emissiveIntensity = (1 - t) * 0.6;
    } else {
      // Night — clouds dim + slight moonlight blue
      cloudMat.emissive.setHex(0x1a2a4a);
      cloudMat.emissiveIntensity = 0.08;
    }
    // Storm darkening: coverage > 0.7 darkens clouds
    const stormDark = Math.max(0, (cloudMat.opacity - 0.3) * 0.5);
    cloudMat.emissiveIntensity = Math.max(0, cloudMat.emissiveIntensity - stormDark);
  };

  return g;
}

/**
 * A4 — lerpAtmosphereForAltitude + sun elevation for sunset ramp.
 * Extended to accept sunElevation for color shifting.
 */
export function lerpAtmosphereForAltitude(group: THREE.Group, altitude: number, sunElevation?: number): void {
  const t = Math.max(0, Math.min(1, altitude));
  const clouds = group.getObjectByName("clouds") as THREE.Mesh | null;
  if (clouds) (clouds.material as THREE.MeshStandardMaterial).opacity = 0.42 * (1 - t * 0.55);
  const haze = group.getObjectByName("haze") as THREE.Mesh | null;
  if (haze) (haze.material as THREE.MeshBasicMaterial).opacity = 0.05 * (1 - t * 0.7);
  const mie = group.getObjectByName("mie") as THREE.Mesh | null;
  if (mie) (mie.material as THREE.MeshBasicMaterial).opacity = 0.015 * (1 - t * 0.6);
  const atmo = group.getObjectByName("atmoShell") as THREE.Mesh | null;
  if (atmo) (atmo.material as THREE.MeshStandardMaterial).opacity = 0.13 * (1 - t * 0.4);
  // A4 — Update cloud sunset coloring if sunElevation provided
  if (sunElevation !== undefined && clouds) {
    const tick = (group as any)._tick;
    if (tick) tick(0, 2, sunElevation);
  }
}
