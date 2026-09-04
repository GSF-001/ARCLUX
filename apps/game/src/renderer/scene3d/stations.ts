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

/** Station: icosahedron hub + torus ring + beacon glow. */
export function buildStation(): THREE.Group {
  const g = new THREE.Group();
  const hub = new THREE.Mesh(
    new THREE.IcosahedronGeometry(80, 1),
    new THREE.MeshStandardMaterial({ color: threeColor(colors.stationHub), metalness: 0.6, roughness: 0.4, emissive: threeColor("#0a1a2a"), emissiveIntensity: 0.7 })
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(190, 20, 14, 64),
    new THREE.MeshStandardMaterial({ color: threeColor(colors.stationRing), metalness: 0.65, roughness: 0.4 })
  );
  ring.rotation.x = 1.5;
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: threeColor(colors.glowStation), transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  beacon.scale.set(160, 160, 1);
  g.add(hub, ring, beacon);
  return g;
}
