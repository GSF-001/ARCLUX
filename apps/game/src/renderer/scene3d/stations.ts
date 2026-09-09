// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/stations.ts — station hub + ring + beacon (anchor sosial/ekonomi,
// 02-station). Moved verbatim dari scene3d.ts. Penempatan per snapshot ada
// di renderRegion (index.ts) — modul ini cuma builder geometri.

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import { makeGlowTexture } from "./bootstrap";
import { makeHullAlbedo, makeRoughnessMap } from "./materials";

/** Station: icosahedron hub + torus ring + beacon glow. */
export function buildStation(texSize = 256): THREE.Group {
  const g = new THREE.Group();
  // 10.V M1.3: hub panel-lines + roughness bervariasi, ring stripe
  // emissive tipis. Material dibuat sekali, di-cache di userData.mats.
  const hubMat = new THREE.MeshStandardMaterial({
    color: threeColor(colors.stationHub), metalness: 0.6,
    map: makeHullAlbedo(colors.stationHub, 0x57A7, texSize),
    roughnessMap: makeRoughnessMap(0x5710, 0.5, 0.7, texSize),
    roughness: 1.0,
    emissive: threeColor("#0a1a2a"), emissiveIntensity: 0.7,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: threeColor(colors.stationRing), metalness: 0.65,
    map: makeHullAlbedo(colors.stationRing, 0xB146, texSize),
    roughnessMap: makeRoughnessMap(0xB147, 0.5, 0.65, texSize),
    roughness: 1.0,
    emissive: threeColor(colors.stationRing), emissiveIntensity: 0.3,
  });
  const hub = new THREE.Mesh(new THREE.IcosahedronGeometry(80, 1), hubMat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(190, 20, 14, 64), ringMat);
  ring.rotation.x = 1.5;
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: threeColor(colors.glowStation), transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  beacon.scale.set(160, 160, 1);
  g.add(hub, ring, beacon);
  g.userData.mats = { hubMat, ringMat };
  return g;
}
