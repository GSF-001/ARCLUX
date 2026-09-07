// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import * as THREE from "three";
import type { GeographySample, GeographyNiche } from "../../../../../../packages/gameserver/planetary/geography";
import { analyzeGeography, suggestFacilityKind, latitudeFromPosition } from "../../../../../../packages/gameserver/planetary/geography";

export const NICHE_COLOR: Record<GeographyNiche, number> = {
  mountain_military: 0x6b7280,
  plains_spaceport: 0x5fe0a0,
  desert_remote: 0xd9a86c,
  polar_observatory: 0x9be8ff,
  coastal: 0x4da6ff,
  valley_hidden: 0x2f6b4a,
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

export const NICHE_ICON: Record<GeographyNiche, string> = {
  mountain_military: "▲",
  plains_spaceport: "⬢",
  desert_remote: "⬡",
  polar_observatory: "⬔",
  coastal: "≋",
  valley_hidden: "⬓",
  generic: "·",
};

export function createGeographyMarker(sample: GeographySample, neighborHeights?: number[]): THREE.Mesh {
  const analysis = analyzeGeography(sample, neighborHeights);
  const geo = new THREE.SphereGeometry(4, 8, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: NICHE_COLOR[analysis.niche],
    emissive: NICHE_COLOR[analysis.niche],
    emissiveIntensity: 0.6,
    roughness: 0.6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(sample.position.x, sample.height + 6, sample.position.z);
  mesh.name = `geography-${analysis.niche}`;
  mesh.userData = { niche: analysis.niche, score: analysis.score, reason: analysis.reason, sample };
  return mesh;
}

export function createGeographyCluster(samples: GeographySample[], neighborMap?: Map<string, number[]>): THREE.Group {
  const group = new THREE.Group();
  group.name = "geography-cluster";
  for (const s of samples) {
    const key = `${s.position.x}:${s.position.z}`;
    const neigh = neighborMap?.get(key);
    const marker = createGeographyMarker(s, neigh);
    group.add(marker);
  }
  return group;
}

export function formatGeographyHud(sample: GeographySample, neighborHeights?: number[]): string {
  const a = analyzeGeography(sample, neighborHeights);
  return `${NICHE_LABEL[a.niche]} (${a.score.toFixed(2)}) - ${a.reason}`;
}

export function suggestForPosition(planetSeed: number, sample: GeographySample, neighbors?: number[]): string {
  return suggestFacilityKind(planetSeed, sample.position, sample, neighbors);
}

export function geographyOverlayColor(niche: GeographyNiche, alpha: number): string {
  const hex = NICHE_COLOR[niche].toString(16).padStart(6, "0");
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return `#${hex}${a}`;
}

export function projectGeographyList(samples: GeographySample[]): Array<{ label: string; niche: GeographyNiche; score: number; lat: number }> {
  return samples.map(s => {
    const a = analyzeGeography(s);
    return { label: NICHE_LABEL[a.niche], niche: a.niche, score: a.score, lat: latitudeFromPosition(s.position) };
  }).sort((a, b) => b.score - a.score);
}
