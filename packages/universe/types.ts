// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Milestone 1 "Kapal Hidup" — World Model core types.
//
// The `.arclux/` manifest is the user-side definition of a vessel. It lives
// in the USER's repository (never here). These types model both the
// on-disk manifest and the live world state that ARCLUX derives from it.
//
// Naming: `arclux.json` is the manifest (user-authored). Everything under
// `state/` is ARCLUX-generated and versioned (see Layer A & provenance).

/** License tier — 3-tier model (Layer C / LicenseValidator). */
export type LicenseTier = "open" | "shared" | "private";

/**
 * A subsystem of a vessel. Mirrors the `systems/` dir in `.arclux/`.
 * health is LIVE state (ARCLUX-generated, 0..100), not authored by user.
 */
export type SubsystemId =
  | "engine"
  | "reactor"
  | "navigation"
  | "defense"
  | "weapons"
  | "ai"
  | string;

export interface SystemState {
  id: SubsystemId;
  label: string;
  /** 0..100 — live state, derived from analysis + damage. NOT user-authored. */
  health: number;
  /** Base stat contributed by this subsystem (0..100). */
  baseStat: number;
  /** Component capability tied to this subsystem. */
  capability?: string;
}

/** A component capability bound to real SDK/MCP functions (Layer C). */
export interface ComponentBinding {
  id: string;
  capability: string;
  license: LicenseTier;
  owner: string;
  /** Provenance story — where this component came from. */
  provenance: string[];
  /** Human readable label. */
  label?: string;
}

/**
 * The user-authored `.arclux/arclux.json` manifest. Everything here is under
 * USER control; it is validated before being folded into a VesselModel.
 */
export interface ArcluxManifest {
  formatVersion: 1;
  name: string;
  license: LicenseTier;
  owner?: string;
  /** Optional user overrides on base stats — anti-abuse capped (K1). */
  override?: Partial<Record<SubsystemId, number>>;
  components?: ComponentBinding[];
}

/** The live vessel state derived from analysis + manifest (Layer B). */
export interface VesselModel {
  /** Stable id, usually repo id. */
  id: string;
  name: string;
  /** Repository this vessel came from. */
  source: {
    org: string;
    repo: string;
    defaultBranch: string;
    analyzedAt: string;
  };
  license: LicenseTier;
  systems: SystemState[];
  components: ComponentBinding[];
  /** Aggregate armor/integrity 0..100. */
  integrity: number;
  /** Aggregate defensive posture 0..100 (attack surface). */
  defense: number;
  /** Aggregate offensive capability 0..100. */
  weapons: number;
  /** Aggregate navigation/engine throughput 0..100 (graph structure). */
  engine: number;
  /**
   * Derivation metadata: which ARCLUX analysis signals fed each stat.
   * Kept explicit so the player can always trace stats back to code.
   */
  derivation: VesselStatDerivation;
}

export interface VesselStatDerivation {
  integrity: DerivationSignal[];
  defense: DerivationSignal[];
  weapons: DerivationSignal[];
  engine: DerivationSignal[];
}

export interface DerivationSignal {
  label: string;
  value: number;
  weight: number;
}

// ─────────────────────────────────────────────────────────────
// Fitting (Fase 1 — blueprint 11 §5, Fase 1)
//
// Component-effect pipeline. Everything here is DERIVED from
// repo analysis (never user-authored) and every function is
// pure + deterministic: same inputs → same outputs, no clock,
// no randomness, no I/O. The server recomputes any client
// projected fit and compares the hash (anti-cheat).
// ─────────────────────────────────────────────────────────────

/** Aggregate stat keys a fit modifies. */
export type FitStatKey = "integrity" | "defense" | "weapons" | "engine";

/**
 * How a component effect modifies its target stat.
 *  - add: flat points added to the current value
 *  - mul: percent multiplier applied to the current value
 *    (value 12 = +12%, value -8 = −8%)
 */
export type EffectOp = "add" | "mul";

/** A single stat modification a component grants while fitted. */
export interface ComponentEffectSpec {
  stat: FitStatKey;
  op: EffectOp;
  value: number;
}

/** Where a component mounts + how many slot capacity it consumes. */
export interface MountSpec {
  subsystem: SubsystemId;
  /** Slot capacity consumed (1 for standard, 2 for tier-3). */
  slotCost: number;
}

/**
 * Static definition of a component — the "module" analogue in
 * the fitting model. Derived deterministically from a
 * ComponentBinding + repo analysis, so the same repository
 * always yields the same definitions.
 */
export interface ComponentDefinition {
  id: string;
  /** Human readable label (falls back to capability). */
  label: string;
  /** SDK/MCP capability this component binds. */
  capability: string;
  /** Complexity tier 1..3 — scales effects, slots + power draw. */
  tier: 1 | 2 | 3;
  mount: MountSpec;
  effects: ComponentEffectSpec[];
  /** Capacitor draw per tick while fitted (capSim input). */
  powerDraw: number;
  /**
   * Family prefix (e.g. "security.") that must be fitted by at
   * least one OTHER component before this one (tier-3 gate).
   */
  requiresCapability?: string;
}

/** Slot capacity per subsystem. */
export type SlotLayout = Record<string, number>;

/**
 * Damage types — the weapon archetypes of the combat ruleset
 * (combat.ts resolveTargetSubsystem maps each to a subsystem).
 */
export type DamageType = "plasma" | "railgun" | "missile" | "emp" | "explosive";

/** Resist profile: damage type → resistance fraction 0..1. */
export type DamageResist = Partial<Record<DamageType, number>>;

/**
 * Incoming damage distribution across damage types. Weights are
 * raw — normalized internally, so {missile: 3, emp: 1} is fine.
 */
export interface DamageProfile {
  name: string;
  distribution: Partial<Record<DamageType, number>>;
}

/** A validation issue produced by the fit pipeline. */
export interface FitIssue {
  componentId?: string;
  code:
    | "slot_overflow"
    | "prerequisite_missing"
    | "unknown_subsystem"
    | "effect_overflow";
  message: string;
  severity: "error" | "warning";
}

/** Result of the fit pipeline — fully recomputed, pure. */
export interface FitResult {
  /** Recomputed subsystem states (health = base + fitted effects). */
  systems: SystemState[];
  /** Aggregate stats (mirror the VesselModel aggregates). */
  stats: { integrity: number; defense: number; weapons: number; engine: number };
  /** Total capacitor draw per tick while this fit is active. */
  powerDraw: number;
  /** True when no error-severity issues exist. */
  valid: boolean;
  issues: FitIssue[];
  /**
   * Deterministic receipt over the fitted state. The server
   * recomputes a client-projected fit and compares this hash —
   * a client cannot forge a fit (deterministic replay anti-cheat).
   */
  hash: string;
}

/** A what-if action evaluated by projectFit. */
export type FitAction =
  | { op: "add"; definition: ComponentDefinition }
  | { op: "remove"; componentId: string };

/** Projection of a fit action: before/after + per-stat deltas. */
export interface FitProjection {
  before: FitResult;
  after: FitResult;
  /** Per-aggregate-stat delta (after − before). */
  deltas: Record<FitStatKey, number>;
  /** Per-subsystem health delta (after − before). */
  systemDeltas: Record<string, number>;
}

/** Per-subsystem damage after resist + ceiling (one attack). */
export interface DamageImpact {
  subsystemId: SubsystemId;
  before: number;
  after: number;
  /** Damage actually dealt (after resist + ceiling + health floor). */
  damage: number;
  /** Damage removed by resistance. */
  resisted: number;
}

/** Result of applying a DamageProfile to a set of subsystem states. */
export interface DamageApplication {
  impacts: DamageImpact[];
  totalDamage: number;
  totalResisted: number;
  /** Allocated raw damage per damage type (before resist). */
  byType: Record<DamageType, number>;
}
