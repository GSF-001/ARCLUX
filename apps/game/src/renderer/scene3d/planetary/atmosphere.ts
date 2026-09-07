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

  (g as any)._tick = (dt: number, windSpeed = 2) => {
    cloud.rotation.y += dt * 0.00042 * (1 + windSpeed * 0.08);
    haze.rotation.y += dt * 0.00018;
  };

  return g;
}

export function lerpAtmosphereForAltitude(group: THREE.Group, altitude: number): void {
  const t = Math.max(0, Math.min(1, altitude));
  const clouds = group.getObjectByName("clouds") as THREE.Mesh | null;
  if (clouds) (clouds.material as THREE.MeshStandardMaterial).opacity = 0.42 * (1 - t * 0.55);
  const haze = group.getObjectByName("haze") as THREE.Mesh | null;
  if (haze) (haze.material as THREE.MeshBasicMaterial).opacity = 0.05 * (1 - t * 0.7);
  const mie = group.getObjectByName("mie") as THREE.Mesh | null;
  if (mie) (mie.material as THREE.MeshBasicMaterial).opacity = 0.015 * (1 - t * 0.6);
  const atmo = group.getObjectByName("atmoShell") as THREE.Mesh | null;
  if (atmo) (atmo.material as THREE.MeshStandardMaterial).opacity = 0.13 * (1 - t * 0.4);
}
