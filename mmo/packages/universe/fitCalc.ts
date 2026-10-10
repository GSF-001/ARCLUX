// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// fitCalc.ts — Fase 1 component-effect pipeline (blueprint 11 §5).
//
// The deterministic, pure, server-authoritative fitting engine:
//
//   analysis → deriveComponentDefinition → computeFit → FitResult
//                                     ↘ projectFit (what-if)
//                                     ↘ applyDamageProfile (incoming damage)
//
// Design laws (non-negotiable):
//   1. DETERMINISM — no Date.now, no Math.random, no I/O. Same
//      base + definitions ALWAYS produce the same FitResult and
//      the same hash. Effects apply in sorted-by-id order, so
//      result is independent of input array order.
//   2. PURITY — inputs are never mutated; every state is copied.
//   3. SERVER AUTHORITY — clients may project fits for UX, but
//      the server recomputes and compares fitHash (anti-cheat:
//      deterministic replay). A forged fit fails verification.
//   4. FIXED-POINT — all stat math rounds to 1 decimal place at
//      each step (round1), capacitor levels to 2 (round2), so
//      floating-point drift can never fork the simulation.
//
// Clean-room: patterns referenced from Pyfa's eos/ effect
// pipeline (GPL-3.0) — reimplemented from scratch in TS. No Pyfa
// code, no EVE data.

import type { AnalyzeRepositoryResult } from "../../../packages/engine/pipeline";
import type {
  ComponentBinding,
  ComponentDefinition,
  DamageApplication,
  DamageImpact,
  DamageProfile,
  DamageResist,
  DamageType,
  FitAction,
  FitIssue,
  FitProjection,
  FitResult,
  FitStatKey,
  SlotLayout,
  SubsystemId,
  SystemState,
} from "./types";

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Max resistance per damage type (anti-abuse cap — no fit can reach 100%). */
export const MAX_RESIST = 0.6;

/**
 * Per-hit damage ceiling for a single damage type within a
 * profile (mirrors combat.ts DAMAGE_CEILING — one attack
 * cannot one-shot, Layer I.7). Kept here so the universe
 * package stays self-contained; gameserver owns the
 * authoritative combat ceiling.
 */
export const FIT_DAMAGE_CEILING = 12;

/** Base slot capacities per subsystem (before analysis scaling). */
const BASE_SLOTS: SlotLayout = {
  engine: 4,
  reactor: 3,
  navigation: 3,
  defense: 4,
  weapons: 4,
  ai: 2,
};

/** Slot layout fallback untuk vessel tanpa layout turunan analisis (legacy). */
export function defaultSlotLayout(): SlotLayout {
  return { ...BASE_SLOTS };
}

/**
 * Capability family → subsystem the component mounts into.
 * Mirrors the capability namespaces produced by the analysis
 * (stats.ts buildDefaultSystems: graph.*, impact.*, search.*,
 * security.*, analyst.*).
 */
const CAPABILITY_FAMILY: readonly (readonly [RegExp, SubsystemId])[] = [
  [/^security\./, "defense"],
  [/^analyst\./, "weapons"],
  [/^impact\./, "reactor"],
  [/^graph\./, "engine"],
  [/^search\./, "navigation"],
];

/** Aggregate stat each subsystem feeds (aggregate = subsystem health). */
const STAT_OF_SUBSYSTEM: Record<string, FitStatKey> = {
  reactor: "integrity",
  defense: "defense",
  weapons: "weapons",
  engine: "engine",
};

/** Subsystem that backs each aggregate stat. */
const SUBSYSTEM_OF_STAT: Record<FitStatKey, SubsystemId> = {
  integrity: "reactor",
  defense: "defense",
  weapons: "weapons",
  engine: "engine",
};

/**
 * Resistance granted per mounted tier, per subsystem, per damage
 * type. Offense-side subsystems (weapons) grant none; plasma /
 * railgun are direct-energy hits resisted by reactor armor.
 */
const RESIST_TABLE: Record<string, Partial<Record<DamageType, number>>> = {
  defense: { missile: 0.05, explosive: 0.03 },
  reactor: { plasma: 0.03, explosive: 0.04 },
  engine: { emp: 0.05 },
  navigation: { emp: 0.02 },
  ai: { emp: 0.02 },
};

// ─────────────────────────────────────────────────────────────
// 1. Component definition derivation (analysis → definition)
// ─────────────────────────────────────────────────────────────

/** Subsystem a capability namespace mounts into (default: engine). */
export function capabilitySubsystem(capability: string): SubsystemId {
  for (const [re, sub] of CAPABILITY_FAMILY) {
    if (re.test(capability)) return sub;
  }
  return "engine";
}

/**
 * Complexity tier from provenance depth: 0–1 entries → tier 1,
 * 2–3 → tier 2, 4+ → tier 3. Deterministic — the same binding
 * always derives the same tier.
 */
export function deriveTier(binding: ComponentBinding): 1 | 2 | 3 {
  const depth = binding.provenance?.length ?? 0;
  const tier = 1 + Math.min(2, Math.floor(depth / 2));
  return tier as 1 | 2 | 3;
}

/**
 * Effects a component grants, derived from its family + tier.
 * Higher tiers scale both the flat add and the percent mul, and
 * tier 3 adds a bonus flat — so rare (deep-provenance)
 * components are meaningfully stronger but cost 2 slots + more
 * power.
 */
export function deriveEffects(
  capability: string,
  tier: 1 | 2 | 3
): ComponentDefinition["effects"] {
  const stat = statForCapability(capability);
  const effects: ComponentDefinition["effects"] = [
    { stat, op: "add", value: 2 * tier },
  ];
  if (tier >= 2) effects.push({ stat, op: "mul", value: 3 * tier });
  if (tier >= 3) effects.push({ stat, op: "add", value: tier });
  return effects;
}

function statForCapability(capability: string): FitStatKey {
  return STAT_OF_SUBSYSTEM[capabilitySubsystem(capability)] ?? "engine";
}

/** Capacitor draw: scales with tier + effect count. */
export function derivePowerDraw(tier: 1 | 2 | 3, effectCount: number): number {
  return tier * 2 + effectCount;
}

/**
 * Derive the full static definition of a component from its
 * binding. Tier-3 components additionally require another
 * component of the same family to be fitted (prerequisite gate).
 */
export function deriveComponentDefinition(binding: ComponentBinding): ComponentDefinition {
  const tier = deriveTier(binding);
  const subsystem = capabilitySubsystem(binding.capability);
  const effects = deriveEffects(binding.capability, tier);
  const definition: ComponentDefinition = {
    id: binding.id,
    label: binding.label ?? binding.capability,
    capability: binding.capability,
    tier,
    mount: { subsystem, slotCost: tier === 3 ? 2 : 1 },
    effects,
    powerDraw: derivePowerDraw(tier, effects.length),
  };
  if (tier === 3) {
    const family = binding.capability.split(".")[0];
    if (family) definition.requiresCapability = `${family}.`;
  }
  return definition;
}

/**
 * Derive the slot layout of a vessel from its analysis. Larger
 * repos (more graph nodes) yield more slots — a vessel's
 * fitting capacity is grounded in what the codebase actually
 * contains, never in user input.
 */
export function deriveSlotLayout(result: AnalyzeRepositoryResult): SlotLayout {
  const nodes = result.graph?.nodes?.length ?? result.moduleCount ?? 0;
  const bonus = Math.min(3, Math.floor(nodes / 25));
  const layout: SlotLayout = {};
  for (const [subsystem, base] of Object.entries(BASE_SLOTS)) {
    const share = subsystem === "engine" || subsystem === "weapons" ? bonus : Math.floor(bonus / 2);
    layout[subsystem] = base + share;
  }
  return layout;
}

// ─────────────────────────────────────────────────────────────
// 2. The fit pipeline (pure, deterministic)
// ─────────────────────────────────────────────────────────────

export interface FitInput {
  /** Engine-derived base subsystem states (deriveBaseStats().systems). */
  base: SystemState[];
  /** Component definitions to fit. Order-independent — sorted internally. */
  definitions: ComponentDefinition[];
  slotLayout: SlotLayout;
}

/** Sort key for deterministic processing: component id, ascending. */
function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Compute a full fit: validate slots + prerequisites, then apply
 * every component effect in deterministic order on top of the
 * engine-derived base. Never mutates its inputs.
 */
export function computeFit(input: FitInput): FitResult {
  const definitions = [...input.definitions].sort(byId);
  const issues: FitIssue[] = [];

  // ── Stage 1: slot constraints (per subsystem, capacity-bounded)
  const slotUsage = new Map<string, number>();
  for (const def of definitions) {
    slotUsage.set(def.mount.subsystem, (slotUsage.get(def.mount.subsystem) ?? 0) + def.mount.slotCost);
  }
  for (const [subsystem, used] of [...slotUsage.entries()].sort()) {
    const capacity = input.slotLayout[subsystem];
    if (capacity === undefined) {
      issues.push({
        code: "unknown_subsystem",
        message: `subsystem "${subsystem}" has no slot capacity in this vessel class`,
        severity: "error",
      });
    } else if (used > capacity) {
      issues.push({
        code: "slot_overflow",
        message: `${subsystem}: ${used}/${capacity} slots — remove or downsize components`,
        severity: "error",
      });
    }
  }

  // ── Stage 2: prerequisite gate (tier-3 needs its family present)
  for (const def of definitions) {
    if (!def.requiresCapability) continue;
    const familyPresent = definitions.some(
      (other) => other.id !== def.id && other.capability.startsWith(def.requiresCapability as string)
    );
    if (!familyPresent) {
      issues.push({
        componentId: def.id,
        code: "prerequisite_missing",
        message: `${def.id} (tier ${def.tier}) requires another ${def.requiresCapability}* component fitted first`,
        severity: "error",
      });
    }
  }

  // ── Stage 3: apply effects (sorted order → order-independence)
  const systems = input.base.map((s) => ({ ...s }));
  for (const def of definitions) {
    for (const effect of def.effects) {
      const subsystem = SUBSYSTEM_OF_STAT[effect.stat];
      const sys = systems.find((s) => s.id === subsystem);
      if (!sys) {
        issues.push({
          componentId: def.id,
          code: "effect_overflow",
          message: `${def.id} targets stat "${effect.stat}" but subsystem "${subsystem}" is absent`,
          severity: "warning",
        });
        continue;
      }
      sys.baseStat =
        effect.op === "add"
          ? clamp(round1(sys.baseStat + effect.value), 0, 100)
          : clamp(round1(sys.baseStat * (1 + effect.value / 100)), 0, 100);
    }
  }
  // Fitted state: health mirrors the recomputed base stat (combat
  // damage is applied on top, separately, by the gameserver).
  for (const sys of systems) sys.health = sys.baseStat;

  const stats = {
    integrity: healthOf(systems, "reactor"),
    defense: healthOf(systems, "defense"),
    weapons: healthOf(systems, "weapons"),
    engine: healthOf(systems, "engine"),
  };
  const powerDraw = definitions.reduce((sum, d) => sum + d.powerDraw, 0);
  const valid = !issues.some((i) => i.severity === "error");

  const result: FitResult = { systems, stats, powerDraw, valid, issues, hash: "" };
  result.hash = fitHash(result, definitions);
  return result;
}

function healthOf(systems: SystemState[], id: SubsystemId): number {
  return systems.find((s) => s.id === id)?.health ?? 0;
}

// ─────────────────────────────────────────────────────────────
// 3. What-if projection (real-time stat preview)
// ─────────────────────────────────────────────────────────────

/**
 * Project a fit action (add / remove one component) against a fit
 * input. Returns before/after states plus per-stat and
 * per-subsystem deltas — the dashboard calls this on every drag
 * to preview a change before committing. Pure: the committed fit
 * is untouched.
 */
export function projectFit(input: FitInput, action: FitAction): FitProjection {
  const before = computeFit(input);
  const nextDefinitions =
    action.op === "add"
      ? [...input.definitions, action.definition]
      : input.definitions.filter((d) => d.id !== action.componentId);
  const after = computeFit({ ...input, definitions: nextDefinitions });

  const deltas = {
    integrity: round1(after.stats.integrity - before.stats.integrity),
    defense: round1(after.stats.defense - before.stats.defense),
    weapons: round1(after.stats.weapons - before.stats.weapons),
    engine: round1(after.stats.engine - before.stats.engine),
  };
  const systemDeltas: Record<string, number> = {};
  for (const afterSys of after.systems) {
    const beforeSys = before.systems.find((s) => s.id === afterSys.id);
    systemDeltas[afterSys.id] = round1(afterSys.health - (beforeSys?.health ?? 0));
  }
  return { before, after, deltas, systemDeltas };
}

// ─────────────────────────────────────────────────────────────
// 4. Fit hash (deterministic receipt, anti-cheat)
// ─────────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit over the canonical serialization of a fit.
 * Stable across runs and platforms (pure integer math, no
 * crypto dependency — safe in every runtime ARCLUX targets).
 */
function fnv1a32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Recursively sort object keys — canonical form for hashing. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Deterministic receipt over a fit. Covers the fitted component
 * set + resulting state, so two fits that produce identical
 * states from identical inputs share a hash — and any tampered
 * projection fails server verification.
 */
export function fitHash(fit: FitResult, definitions: ComponentDefinition[]): string {
  const receipt = {
    components: definitions.map((d) => d.id).sort(),
    systems: fit.systems.map((s) => ({ id: s.id, stat: s.baseStat })),
    stats: fit.stats,
    powerDraw: fit.powerDraw,
  };
  return fnv1a32(JSON.stringify(canonicalize(receipt)));
}

// ─────────────────────────────────────────────────────────────
// 5. Damage profile → resist matrix (fit-dependent defense)
// ─────────────────────────────────────────────────────────────

/**
 * Compute the damage resistance profile of a fit. Every mounted
 * component contributes its subsystem's resist per tier; total
 * per type is capped at MAX_RESIST so no fit can become immune.
 */
export function computeResists(definitions: ComponentDefinition[]): DamageResist {
  const acc: Record<DamageType, number> = {
    plasma: 0,
    railgun: 0,
    missile: 0,
    emp: 0,
    explosive: 0,
  };
  for (const def of definitions) {
    const row = RESIST_TABLE[def.mount.subsystem];
    if (!row) continue;
    for (const [type, perTier] of Object.entries(row)) {
      acc[type as DamageType] += perTier * def.tier;
    }
  }
  const out: DamageResist = {};
  for (const type of Object.keys(acc) as DamageType[]) {
    const capped = Math.min(MAX_RESIST, acc[type]);
    if (capped > 0) out[type] = round2(capped);
  }
  return out;
}

/** Damage type → subsystem it damages (mirrors combat.ts mapping). */
function targetSubsystemOf(type: DamageType): SubsystemId {
  switch (type) {
    case "plasma":
    case "railgun":
      return "weapons";
    case "missile":
      return "defense";
    case "emp":
      return "engine";
    case "explosive":
      return "reactor";
  }
}

/** Normalize a raw distribution to weights summing to 1. */
function normalizeDistribution(
  distribution: Partial<Record<DamageType, number>>
): Record<DamageType, number> {
  const types: DamageType[] = ["plasma", "railgun", "missile", "emp", "explosive"];
  const raw = { plasma: 0, railgun: 0, missile: 0, emp: 0, explosive: 0 };
  let total = 0;
  for (const type of types) {
    const w = distribution[type];
    if (typeof w === "number" && w > 0) {
      raw[type] = w;
      total += w;
    }
  }
  if (total === 0) {
    // Empty profile → even spread (deterministic fallback).
    for (const type of types) raw[type] = 1 / types.length;
    return raw;
  }
  for (const type of types) raw[type] = raw[type] / total;
  return raw;
}

/**
 * Apply a damage profile to a set of subsystem states WITHOUT
 * mutating them. Each damage type is allocated by its normalized
 * weight, reduced by the fit's resistance, capped per-hit by the
 * ceiling, and floored by the target's current health. Returns
 * the impacts a caller (gameserver combat) can apply authoritatively.
 */
export function applyDamageProfile(
  systems: SystemState[],
  resists: DamageResist,
  profile: DamageProfile,
  rawDamage: number,
  ceiling: number = FIT_DAMAGE_CEILING
): DamageApplication {
  const weights = normalizeDistribution(profile.distribution);
  const byType = {} as Record<DamageType, number>;
  const perTypeDealt = {} as Record<DamageType, number>;
  const perTypeResisted = {} as Record<DamageType, number>;

  for (const type of Object.keys(weights) as DamageType[]) {
    const allocated = round1(rawDamage * weights[type]);
    const resist = Math.min(MAX_RESIST, resists[type] ?? 0);
    const resisted = round1(allocated * resist);
    byType[type] = allocated;
    perTypeResisted[type] = resisted;
    perTypeDealt[type] = round1(Math.max(0, allocated - resisted));
  }

  // Aggregate per subsystem (plasma + railgun both hit weapons).
  const impacts: DamageImpact[] = [];
  const bySubsystem = new Map<SubsystemId, { dealt: number; resisted: number }>();
  for (const type of Object.keys(perTypeDealt) as DamageType[]) {
    const target = targetSubsystemOf(type);
    const entry = bySubsystem.get(target) ?? { dealt: 0, resisted: 0 };
    entry.dealt += perTypeDealt[type];
    entry.resisted += perTypeResisted[type];
    bySubsystem.set(target, entry);
  }
  for (const [subsystemId, entry] of [...bySubsystem.entries()].sort()) {
    // Only report subsystems the profile actually reaches
    // (dealt or resisted) — untouched subsystems are noise.
    if (entry.dealt <= 0 && entry.resisted <= 0) continue;
    const sys = systems.find((s) => s.id === subsystemId);
    const before = sys?.health ?? 0;
    const perHitCapped = Math.min(entry.dealt, ceiling);
    const damage = round1(Math.min(perHitCapped, before));
    impacts.push({
      subsystemId,
      before,
      after: round1(Math.max(0, before - damage)),
      damage,
      resisted: round1(entry.resisted),
    });
  }

  const totalDamage = round1(impacts.reduce((sum, i) => sum + i.damage, 0));
  const totalResisted = round1(Object.values(perTypeResisted).reduce((sum, r) => sum + r, 0));
  return { impacts, totalDamage, totalResisted, byType };
}
