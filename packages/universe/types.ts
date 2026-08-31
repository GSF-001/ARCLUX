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
