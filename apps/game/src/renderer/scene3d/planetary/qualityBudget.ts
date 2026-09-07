// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/qualityBudget.ts - 10.X.4 Quality FAR->CINEMATIC graceful degrade + Budget proximity->importance->cost + determinism planetSeed+tick+chunkKey + persistence boundary (transient vs persistent). Zoom dari blueprint "Quality FAR->CINEMATIC graceful degrade + Budget proximity->importance->cost + determinism seeding + persistence boundary".

// WIRE NOTE for SESSION 2: import { deriveQualityLevel, getBudget, isPersistent } from "./planetary/qualityBudget" di scene3d/index.ts. Decide per volume whether to spawn high-res god rays etc.

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type QualityLevel = "FAR" | "MEDIUM" | "NEAR" | "CINEMATIC";

export const QUALITY_COST: Record<QualityLevel, number> = {
  FAR: 0.15, // scattering/coverage only
  MEDIUM: 0.35, // rain/fog/shadow
  NEAR: 0.65, // dust/spray
  CINEMATIC: 1.0, // volumetrics/high-res god rays
};

export function deriveQualityLevel(distance: number, volumeCost: number): QualityLevel {
  // distance 0..80 -> CINEMATIC, 80..300 -> NEAR, 300..1200 -> MEDIUM, >1200 -> FAR
  // volumeCost 0..1 modulates (low cost -> drop one level)
  const raw: QualityLevel = distance < 80 ? "CINEMATIC" : distance < 300 ? "NEAR" : distance < 1200 ? "MEDIUM" : "FAR";
  if (volumeCost < 0.3 && raw === "CINEMATIC") return "NEAR";
  if (volumeCost < 0.15 && raw === "NEAR") return "MEDIUM";
  return raw;
}

export interface BudgetDecision {
  quality: QualityLevel;
  cost: number; // 0..1
  allowParticles: boolean;
  allowGodRays: boolean;
  allowShadows: boolean;
}

export function getBudget(
  distance: number,
  volumeCost: number,
  importance: number, // 0..1 (landing 1, facility 0.7, distant 0.2)
): BudgetDecision {
  const quality = deriveQualityLevel(distance, volumeCost);
  const cost = QUALITY_COST[quality] * (0.5 + importance * 0.5) * (0.3 + volumeCost * 0.7);
  return {
    quality,
    cost: Math.min(1, cost),
    allowParticles: quality !== "FAR",
    allowGodRays: quality === "CINEMATIC" || quality === "NEAR",
    allowShadows: quality !== "FAR",
  };
}

// Determinism: planetSeed+tick+chunkKey+position -> same quality, no uncontrolled randomness
export function deterministicJitter(planetSeed: number, tick: number, chunkKey: string, pos: { x: number; z: number }): number {
  let h = 2166136261;
  const s = `${planetSeed}:${chunkKey}:${Math.floor(tick / 30)}:${Math.floor(pos.x / 100)}:${Math.floor(pos.z / 100)}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296; // 0..1
}

// Persistence boundary: persistent vs transient
export function isPersistent(effect: string): boolean {
  // Persistent: weather/facility/terrain/vessel/events — survive handoff/reconnect
  const persistent = ["weather", "facility", "terrain", "vessel", "facilityState", "chunk"];
  // Transient: particles/god rays/fog/splash/flash — regenerated after handoff
  const transient = ["particles", "godRays", "fog", "splash", "flash", "spray", "dust"];
  if (persistent.some((p) => effect.includes(p))) return true;
  if (transient.some((t) => effect.includes(t))) return false;
  return false; // default transient
}

// Handoff/regeneration hint: SESSION 2 calls this on reconnect to know what to regenerate
export function getTransientEffects(): string[] {
  return ["particles", "godRays", "fog", "splash", "flash", "spray"];
}

export function shouldAllowEffect(decision: BudgetDecision, effect: string): boolean {
  if (effect === "godRays") return decision.allowGodRays;
  if (effect === "particles") return decision.allowParticles;
  if (effect === "shadows") return decision.allowShadows;
  return decision.cost < 0.6;
}

export function adaptQualityForFps(current: QualityLevel, fps: number): QualityLevel {
  if (fps < 28 && current === "CINEMATIC") return "NEAR";
  if (fps < 24 && current === "NEAR") return "MEDIUM";
  if (fps < 20) return "FAR";
  if (fps > 55 && current === "FAR") return "MEDIUM";
  return current;
}

