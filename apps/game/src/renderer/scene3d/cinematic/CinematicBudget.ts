// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

export type BudgetTier = "FAR" | "MEDIUM" | "NEAR" | "CINEMATIC";

export interface BudgetState {
  tier: BudgetTier;
  cost: number;
  allowVolumetrics: boolean;
  allowHighResGodRays: boolean;
  allowParticles: boolean;
  allowShadows: boolean;
}

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

export function deriveBudgetTier(distance: number, volumeCost: number, effectCost: number): BudgetTier {
  const d = distance + volumeCost * 220;
  const c = effectCost;
  if (d > 5200 || c > 0.92) return "FAR";
  if (d > 1800 || c > 0.62) return "MEDIUM";
  if (d > 420 || c > 0.32) return "NEAR";
  return "CINEMATIC";
}

export function deriveBudgetState(distance: number, volumeCost: number, effectCost: number, cinematicPriority: number): BudgetState {
  const tier = deriveBudgetTier(distance, volumeCost, effectCost);
  const priorityBoost = cinematicPriority > 80 ? 1 : cinematicPriority > 50 ? 0.62 : 0.32;
  const cost = clamp01((volumeCost * 0.42 + effectCost * 0.48 + (tier === "FAR" ? 0.72 : tier === "MEDIUM" ? 0.42 : tier === "NEAR" ? 0.18 : 0)) * (0.72 + priorityBoost * 0.28));
  return {
    tier,
    cost,
    allowVolumetrics: tier === "CINEMATIC" || tier === "NEAR",
    allowHighResGodRays: tier === "CINEMATIC",
    allowParticles: tier !== "FAR",
    allowShadows: tier === "CINEMATIC" || tier === "NEAR" || tier === "MEDIUM",
  };
}

export function continuityProgress(from: BudgetTier, to: BudgetTier, t: number): number {
  const order: BudgetTier[] = ["FAR", "MEDIUM", "NEAR", "CINEMATIC"];
  const fi = order.indexOf(from);
  const ti = order.indexOf(to);
  if (fi === ti) return 1;
  const dir = ti > fi ? 1 : -1;
  const steps = Math.abs(ti - fi);
  return clamp01(t * steps * dir * 0.42 + fi * 0.12);
}

export function shouldAllowEffect(state: BudgetState, effect: "volumetrics" | "godRays" | "particles" | "shadows"): boolean {
  if (effect === "volumetrics") return state.allowVolumetrics;
  if (effect === "godRays") return state.allowHighResGodRays;
  if (effect === "particles") return state.allowParticles;
  return state.allowShadows;
}

export function adaptQualityForFps(baseline: BudgetTier, fps: number): BudgetTier {
  if (fps > 52) return baseline;
  if (fps > 32) return baseline === "CINEMATIC" ? "NEAR" : baseline;
  if (fps > 22) return baseline === "CINEMATIC" || baseline === "NEAR" ? "MEDIUM" : baseline;
  return "FAR";
}
