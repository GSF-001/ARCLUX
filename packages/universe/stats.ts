// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Milestone 1 — Map an ARCLUX analysis result onto vessel stats (Layer B).
//
// The mapping table from the blueprint:
//   Armor/Integrity      <- computeHealthScore
//   Weapons              <- components + security findings
//   Defense              <- layer violations / attack surface
//   Engine/Navigation    <- graph structure (nodes/edges/module counts)
//
// This is the "base-stat" half of K1 (Hybrid): ARCLUX computes the base
// automatically from analysis; user overrides (validated/anti-abuse) come
// later and must never exceed the cap enforced by the validator.

import type { AnalyzeRepositoryResult } from "../engine/pipeline";
import type {
  ArcluxManifest,
  ComponentBinding,
  DerivationSignal,
  SystemState,
  VesselModel,
  VesselStatDerivation,
} from "./types";

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

interface EngineSignals {
  integrity: DerivationSignal[];
  defense: DerivationSignal[];
  weapons: DerivationSignal[];
  engine: DerivationSignal[];
}

/**
 * Compute base vessel stats from a fresh analysis result. Does NOT read the
 * manifest — it produces the engine-derived "base" that user overrides later
 * modify under validation.
 */
export function deriveBaseStats(result: AnalyzeRepositoryResult): {
  systems: SystemState[];
  integrity: number;
  defense: number;
  weapons: number;
  engine: number;
  derivation: VesselStatDerivation;
} {
  const signals = collectEngineSignals(result);

  const integrity = weightedMean(signals.integrity);
  const defense = weightedMean(signals.defense);
  const weapons = weightedMean(signals.weapons);
  const engine = weightedMean(signals.engine);

  const systems = buildDefaultSystems({ integrity, defense, weapons, engine });

  return {
    systems,
    integrity,
    defense,
    weapons,
    engine,
    derivation: signals,
  };
}

function weightedMean(signals: DerivationSignal[]): number {
  if (signals.length === 0) return 50;
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0) || 1;
  const weighted = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
  return round1(clamp(weighted / totalWeight));
}

function collectEngineSignals(result: AnalyzeRepositoryResult): EngineSignals {
  return {
    integrity: integritySignals(result),
    defense: defenseSignals(result),
    weapons: weaponsSignals(result),
    engine: engineSignals(result),
  };
}

function integritySignals(result: AnalyzeRepositoryResult): DerivationSignal[] {
  const signals: DerivationSignal[] = [];
  const health = result.scanSummary?.filesParsed ?? 0;
  const modules = result.moduleCount ?? 0;
  signals.push({
    label: "Structural health",
    value: healthFactor(health, modules),
    weight: 2,
  });
  return signals;
}

function healthFactor(parsed: number, failedOrEmpty: number): number {
  // Derived from parse success vs module count. Higher successful parse
  // coverage => stronger structural integrity.
  const total = parsed + failedOrEmpty;
  if (total === 0) return 50;
  return clamp((parsed / total) * 100);
}

function defenseSignals(result: AnalyzeRepositoryResult): DerivationSignal[] {
  const signals: DerivationSignal[] = [];
  const security = result.securityAnalysis?.findings ?? [];
  const findings = security.length;
  const cleanScore = findings === 0 ? 100 : clamp(100 - findings * 5);
  signals.push({ label: "Security posture", value: cleanScore, weight: 2 });
  signals.push({
    label: "Dependency hygiene",
    value: result.moduleCount ? 100 : 50,
    weight: 1,
  });
  return signals;
}

function weaponsSignals(result: AnalyzeRepositoryResult): DerivationSignal[] {
  const signals: DerivationSignal[] = [];
  const security = result.securityAnalysis?.findings ?? [];
  const attackSurface = security.length;
  // More exposed attack surface => more raw "weapon potential" but less
  // defensive confidence. Here we model weapons as capability present in
  // the codebase scaled down by unresolved findings.
  const enabled = clamp(100 - attackSurface * 3);
  signals.push({ label: "Attack surface present", value: enabled, weight: 1 });
  return signals;
}

function engineSignals(result: AnalyzeRepositoryResult): DerivationSignal[] {
  const signals: DerivationSignal[] = [];
  const nodes = result.graph?.nodes?.length ?? result.moduleCount ?? 0;
  const edges = result.graph?.edges?.length ?? 0;
  const connectivity = edges === 0 ? 30 : clamp((edges / Math.max(nodes, 1)) * 100);
  signals.push({ label: "Graph size", value: clamp(nodes), weight: 1 });
  signals.push({ label: "Connectivity", value: connectivity, weight: 1 });
  return signals;
}

function buildDefaultSystems(stats: {
  integrity: number;
  defense: number;
  weapons: number;
  engine: number;
}): SystemState[] {
  return [
    { id: "engine", label: "Engine", health: stats.engine, baseStat: stats.engine, capability: "graph.navigation" },
    { id: "reactor", label: "Reactor", health: stats.integrity, baseStat: stats.integrity, capability: "impact.trace" },
    { id: "navigation", label: "Navigation", health: stats.engine, baseStat: stats.engine, capability: "search.route" },
    { id: "defense", label: "Defense", health: stats.defense, baseStat: stats.defense, capability: "security.scan" },
    { id: "weapons", label: "Weapons", health: stats.weapons, baseStat: stats.weapons, capability: "analyst.expose" },
  ];
}

/**
 * Merge a validated user manifest over the derived base stats (K1 Hybrid).
 * Overrides are applied then capped so a user cannot exceed the ceiling the
 * engine computed — enforce with LicenseValidator / a schema validator before
 * calling this.
 */
export function mergeManifest(
  base: ReturnType<typeof deriveBaseStats>,
  manifest?: Partial<ArcluxManifest>
): { systems: SystemState[]; components: ComponentBinding[] } {
  const systems = base.systems.map((s) => {
    if (!manifest?.override || !(s.id in manifest.override)) return s;
    const target = Math.round(manifest.override[s.id] ?? s.baseStat);
    const capped = Math.min(target, s.baseStat + 10); // anti-abuse cap (K1-C)
    return { ...s, baseStat: capped, health: capped };
  });
  const components = manifest?.components ?? [];
  return { systems, components };
}

/**
 * Highest-level convenience: analysis result + optional manifest -> full
 * VesselModel. Derives base stats, merges validated overrides, and wires
 * provenance-facing fields.
 */
export function buildVesselModel(
  result: AnalyzeRepositoryResult,
  manifest?: Partial<ArcluxManifest>
): VesselModel {
  const base = deriveBaseStats(result);
  const { systems, components } = mergeManifest(base, manifest);

  const name = manifest?.name ?? result.meta.name;
  const license = manifest?.license ?? "open";

  return {
    id: result.meta.id,
    name,
    source: {
      org: result.meta.org,
      repo: result.meta.name,
      defaultBranch: result.meta.defaultBranch,
      analyzedAt: result.meta.analyzedAt,
    },
    license,
    systems,
    components,
    integrity: systems.find((s) => s.id === "reactor")?.health ?? base.integrity,
    defense: systems.find((s) => s.id === "defense")?.health ?? base.defense,
    weapons: systems.find((s) => s.id === "weapons")?.health ?? base.weapons,
    engine: systems.find((s) => s.id === "engine")?.health ?? base.engine,
    derivation: base.derivation,
  };
}
