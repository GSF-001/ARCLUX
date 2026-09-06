// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/geography.ts - 10.6 client visual hints for strategic geography (mountain/plains/polar/coastal/valley). Reads height/slope/biome from terrain.ts + server geography resolver.

// Client visual - gak duplikat server logic, cuma hint warna/icon + sharing position.

import * as THREE from "three";
import type { GeographySample, GeographyNiche } from "../../../../../../packages/gameserver/planetary/geography";
import { analyzeGeography } from "../../../../../../packages/gameserver/planetary/geography";

// ---------------------------------------------------------------------------
// Visual hint - color per niche (HUD/minimap)
// ---------------------------------------------------------------------------

export const NICHE_COLOR: Record<GeographyNiche, number> = {
  mountain_military: 0x6b7280, // slate - mountain
  plains_spaceport: 0x5fe0a0, // green - plains
  desert_remote: 0xd9a86c, // sand - desert
  polar_observatory: 0x9be8ff, // ice - polar
  coastal: 0x4da6ff, // blue - coastal
  valley_hidden: 0x2f6b4a, // dark green - valley
  generic: 0x8a8f98,
};

export const NICHE_LABEL: Record<GeographyNiche, string> = {
  mountain_military: "Mountain - Military",
  plains_spaceport: "Plains - Spaceport",
  desert_remote: "Desert - Remote",
  polar_observatory: "Polar - Observatory",
  coastal: "Coastal",
  valley_hidden: "Valley - Hidden",
  generic: "Generic",
};

/** Buat marker kecil di terrain untuk debug/visual hint (sphere 4m, color niche). */
export function createGeographyMarker(sample: GeographySample, neighborHeights?: number[]): THREE.Mesh {
  const analysis = analyzeGeography(sample, neighborHeights);
  const geo = new THREE.SphereGeometry(4, 8, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: NICHE_COLOR[analysis.niche],
    emissive: NICHE_COLOR[analysis.niche],
    emissiveIntensity: 0.6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(sample.position.x, sample.height + 6, sample.position.z);
  mesh.name = `geography-${analysis.niche}`;
  mesh.userData = { niche: analysis.niche, score: analysis.score, reason: analysis.reason };
  return mesh;
}

/** HUD string: "Mountain - Military (0.82) - h=420 slope=0.52". */
export function formatGeographyHud(sample: GeographySample, neighborHeights?: number[]): string {
  const a = analyzeGeography(sample, neighborHeights);
  return `${NICHE_LABEL[a.niche]} (${a.score.toFixed(2)}) - ${a.reason}`;
}
