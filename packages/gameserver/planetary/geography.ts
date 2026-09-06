// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/geography.ts - 10.6 strategic geography: mountains->military, plains->spaceport, poles->observatory, coastline/valleys. Zoom dari blueprint "heightmap deterministically (mulberry32) creates: mountains, plains, desert..."

// Blueprint 10 §10 strategic geography: heightmap deterministik bikin lokasi
// strategis tanpa hand-placed cities. File ini ZOOM dari 1 baris blueprint
// jadi 6 resolver per-niche + scoring + suggestFacility, biar code gak ngarang.

import type { Vec3 } from "../types";

// ---------------------------------------------------------------------------
// Types - geography sample di satu titik (bukan global)
// ---------------------------------------------------------------------------

export type GeographyNiche =
  | "mountain_military"
  | "plains_spaceport"
  | "desert_remote"
  | "polar_observatory"
  | "coastal"
  | "valley_hidden"
  | "generic";

export interface GeographySample {
  /** Height dari heightmap (m). */
  height: number;
  /** Slope 0..1 (0.4 -> military). */
  slope: number;
  /** Biome dari terrain state. */
  biome: "plains" | "mountain" | "desert" | "forest" | "snow" | "wetland";
  /** Latitude -90..90 dari position Vec3 normalized. */
  latitude: number;
  /** Jarak ke coastline terdekat (m) - dari heightmap ocean threshold. */
  distToCoast: number;
  /** Forest density 0..1. */
  forestDensity: number;
  /** Wetness 0..1. */
  wetness: number;
  /** Position Vec3 (untuk latitude & sharing). */
  position: Vec3;
}

export interface GeographyAnalysis {
  niche: GeographyNiche;
  score: number; // 0..1, 1 = paling cocok niche ini
  suggestedKinds: string[]; // FacilityKind yang cocok
  reason: string;
  strategicWeight: number; // 0..1 untuk placement priority
}

// ---------------------------------------------------------------------------
// Deterministic helpers - mulberry32(planetSeed + position) biar geography
// gak berubah tiap reload, tapi gak perlu heightmap global di server
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Per-niche resolver - masing-masing ada threshold + scoring, bukan 1 if
// ---------------------------------------------------------------------------

/** Mountains (slope>0.4, height 200..1200, biome mountain) -> military/hangar hidden. */
export function isMountainMilitary(s: GeographySample): { ok: boolean; score: number } {
  if (s.slope < 0.4) return { ok: false, score: 0 };
  if (s.height < 80 || s.height > 1400) return { ok: false, score: 0 };
  const slopeScore = Math.min(1, (s.slope - 0.4) / 0.4); // 0.4->0, 0.8->1
  const heightScore = s.height > 400 && s.height < 900 ? 1 : 0.6;
  const biomeBonus = s.biome === "mountain" ? 0.2 : 0;
  return { ok: true, score: Math.min(1, slopeScore * 0.6 + heightScore * 0.4 + biomeBonus) };
}

/** Plains (slope<0.1, height -5..120, biome plains) -> spaceport/landing pad. */
export function isPlainsSpaceport(s: GeographySample): { ok: boolean; score: number } {
  if (s.slope > 0.12) return { ok: false, score: 0 };
  if (s.height < -5 || s.height > 140) return { ok: false, score: 0 };
  const flatScore = 1 - s.slope / 0.12;
  const heightScore = s.height > 0 && s.height < 80 ? 1 : 0.7;
  const biomeBonus = s.biome === "plains" ? 0.2 : s.biome === "desert" ? 0.1 : 0;
  return { ok: true, score: Math.min(1, flatScore * 0.5 + heightScore * 0.5 + biomeBonus) };
}

/** Desert (biome desert, wetness<0.2, forest<0.2) -> remote/manufacturing. */
export function isDesertRemote(s: GeographySample): { ok: boolean; score: number } {
  if (s.biome !== "desert" && s.wetness > 0.25) return { ok: false, score: 0 };
  if (s.forestDensity > 0.3) return { ok: false, score: 0 };
  const dryScore = 1 - s.wetness;
  const openScore = 1 - s.forestDensity;
  return { ok: true, score: dryScore * 0.6 + openScore * 0.4 };
}

/** Poles (lat >60 atau <-60, snow/biome snow) -> observatory/comms. */
export function isPolarObservatory(s: GeographySample): { ok: boolean; score: number } {
  const absLat = Math.abs(s.latitude);
  if (absLat < 55) return { ok: false, score: 0 };
  const latScore = (absLat - 55) / 35; // 55->0, 90->1
  const snowBonus = s.biome === "snow" ? 0.3 : s.height > 300 ? 0.15 : 0;
  return { ok: true, score: Math.min(1, latScore * 0.7 + snowBonus) };
}

/** Coastline <2km -> coastal facilities (spaceport, storage, radar). */
export function isCoastal(s: GeographySample): { ok: boolean; score: number } {
  if (s.distToCoast > 2000) return { ok: false, score: 0 };
  if (s.height < -10) return { ok: false, score: 0 }; // di laut, bukan coast
  const coastScore = 1 - s.distToCoast / 2000;
  const flatBonus = s.slope < 0.2 ? 0.2 : 0;
  return { ok: true, score: Math.min(1, coastScore * 0.8 + flatBonus) };
}

/** Valleys (height 10..200, slope 0.1..0.3, diapit mountain) -> hidden facility. */
export function isValleyHidden(s: GeographySample, neighborHeights?: number[]): { ok: boolean; score: number } {
  if (s.slope < 0.08 || s.slope > 0.35) return { ok: false, score: 0 };
  if (s.height < -5 || s.height > 250) return { ok: false, score: 0 };
  let valleyBonus = 0.5;
  if (neighborHeights && neighborHeights.length >= 2) {
    const maxNeighbor = Math.max(...neighborHeights);
    if (maxNeighbor > s.height + 80) valleyBonus = 1; // diapit gunung +80m
  }
  return { ok: true, score: valleyBonus * (1 - Math.abs(s.slope - 0.18) / 0.18) };
}

// ---------------------------------------------------------------------------
// Main resolver - pilih niche terbaik + suggested kinds
// ---------------------------------------------------------------------------

const NICHE_KINDS: Record<GeographyNiche, string[]> = {
  mountain_military: ["Military", "Hangar", "Radar"],
  plains_spaceport: ["Spaceport", "Landing Pad", "Storage"],
  desert_remote: ["Manufacturing", "Storage", "Military"],
  polar_observatory: ["Comms", "Radar", "Storage"],
  coastal: ["Spaceport", "Storage", "Radar", "Landing Pad"],
  valley_hidden: ["Hangar", "Military", "Repair", "Storage"],
  generic: ["Landing Pad", "Storage", "Repair"],
};

export function analyzeGeography(s: GeographySample, neighborHeights?: number[]): GeographyAnalysis {
  const candidates: { niche: GeographyNiche; score: number }[] = [
    { niche: "mountain_military", ...isMountainMilitary(s) },
    { niche: "plains_spaceport", ...isPlainsSpaceport(s) },
    { niche: "desert_remote", ...isDesertRemote(s) },
    { niche: "polar_observatory", ...isPolarObservatory(s) },
    { niche: "coastal", ...isCoastal(s) },
    { niche: "valley_hidden", ...isValleyHidden(s, neighborHeights) },
  ].filter(c => c.score > 0) as any;

  if (candidates.length === 0) {
    return { niche: "generic", score: 0.5, suggestedKinds: NICHE_KINDS.generic, reason: "generic flat", strategicWeight: 0.4 };
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return {
    niche: best.niche,
    score: best.score,
    suggestedKinds: NICHE_KINDS[best.niche],
    reason: `${best.niche} score ${best.score.toFixed(2)} (h=${s.height.toFixed(0)} slope=${s.slope.toFixed(2)} lat=${s.latitude.toFixed(0)} coast=${s.distToCoast.toFixed(0)})`,
    strategicWeight: best.score * 0.8 + 0.2,
  };
}

/** Deterministik suggest - planetSeed + position hash -> pilih 1 dari suggested. */
export function suggestFacilityKind(
  planetSeed: number,
  position: Vec3,
  s: GeographySample,
  neighborHeights?: number[],
): string {
  const analysis = analyzeGeography(s, neighborHeights);
  const rnd = mulberry32(hashStr(`${planetSeed}:${position.x.toFixed(0)}:${position.z.toFixed(0)}`));
  const kinds = analysis.suggestedKinds;
  return kinds[Math.floor(rnd() * kinds.length)];
}

/** Latitude dari Vec3 position (asumsi sphere radius ~6371km, y = north). */
export function latitudeFromPosition(pos: Vec3, planetRadius = 6371000): number {
  const r = Math.hypot(pos.x, pos.y, pos.z) || planetRadius;
  return (Math.asin(pos.y / r) * 180) / Math.PI;
}
