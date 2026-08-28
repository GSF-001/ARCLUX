// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// ARCLUX programmatic API — the `arclux` package as a library, not just a
// CLI binary. `import { analyzeRepository } from 'arclux'`.
//
// This file is bundled separately (dist/arclux-lib.mjs) from the CLI
// (dist/arclux.mjs) so a consumer can embed the full engine without
// pulling in commander/@clack/commander UI deps.

// ── engine ────────────────────────────────────────────────────────────────
export {
  analyzeRepository,
  ensureParsersRegistered,
  parseOrgAndName,
} from "../../packages/engine/pipeline";
export { runDoctor } from "../../packages/engine/runDoctor";
export { runAllChecks } from "../../packages/engine/contract";
export { computeHealthScore } from "../../packages/engine/healthScore";

// ── graph ─────────────────────────────────────────────────────────────────
export { buildDependencyGraph } from "../../packages/graph/buildDependencyGraph";
export { buildCallGraph } from "../../packages/graph/buildCallGraph";
export { buildImportGraph } from "../../packages/graph/buildImportGraph";
export { buildExportGraph } from "../../packages/graph/buildExportGraph";
export { buildFolderGraph } from "../../packages/graph/buildFolderGraph";

// ── impact ────────────────────────────────────────────────────────────────
export { traceConsumers } from "../../packages/impact/traceConsumers";
export { traceDependencies } from "../../packages/impact/traceDependencies";
export { calculateAffectedFiles } from "../../packages/impact/calculateAffectedFiles";
export { calculateAffectedModules } from "../../packages/impact/calculateAffectedModules";
export { calculateAffectedRoutes } from "../../packages/impact/calculateAffectedRoutes";
export { calculateAffectedComponents } from "../../packages/impact/calculateAffectedComponents";
export { buildImpactTree } from "../../packages/impact/buildImpactTree";

// ── search ────────────────────────────────────────────────────────────────
export { buildSearchIndex } from "../../packages/search/SearchIndex";
export { search } from "../../packages/search/SearchEngine";

// ── security ──────────────────────────────────────────────────────────────
export { analyzeRepositorySecurity } from "../../packages/security-analysis/integration";
export { mapAttackSurface } from "../../packages/correlation/AttackSurfaceMapper";

// ── rules ─────────────────────────────────────────────────────────────────
export { runRules } from "../../packages/rules/RuleEngine";

// ── diagnostics ───────────────────────────────────────────────────────────
export { runDiagnostics } from "../../packages/diagnostics/DiagnosticEngine";
export { getFixSuggestions } from "../../packages/diagnostics/FixSuggestion";

// ── universe (vessel world model) ─────────────────────────────────────────
export {
  deriveBaseStats,
  mergeManifest,
  buildVesselModel,
} from "../../packages/universe/stats";
export { connectRepository } from "../../packages/universe/connect";
export {
  checkComponent,
  validateVesselComponents,
  OVERRIDE_CAP_OFFSET,
} from "../../packages/universe/license";
export { validateManifest, capOverride } from "../../packages/universe/schema";
export type {
  VesselModel,
  SystemState,
  ComponentBinding,
  SubsystemId,
  ArcluxManifest,
  LicenseTier,
  VesselStatDerivation,
} from "../../packages/universe/types";

// ── gameserver (authoritative MMO server core) ────────────────────────────
export { WorldRegion, distanceBetween, regionFromState } from "../../packages/gameserver/world";
export { validateIntent } from "../../packages/gameserver/validator";
export { SimulationEngine, computeEntityHash } from "../../packages/gameserver/simulation";
export {
  applyCombatIntent,
  DAMAGE_CEILING,
} from "../../packages/gameserver/combat";
export {
  WorldRegion as WorldRegionType,
} from "../../packages/gameserver/world";
export type {
  GameEntity,
  VesselEntity,
  StationEntity,
  WorldEntity,
  RegionState,
  GameEvent,
  PlayerIntent,
  Vec3,
  FactionId,
  EntityKind,
} from "../../packages/gameserver/types";
export type {
  SimulationOptions,
  TickResult,
} from "../../packages/gameserver/simulation";
export type {
  ValidationResult,
  ValidatorDecision,
  ValidatorContext,
} from "../../packages/gameserver/validator";
export type {
  CombatImpact,
  CombatLogger,
} from "../../packages/gameserver/combat";

// ── types ─────────────────────────────────────────────────────────────────
export type {
  AnalyzeRepositoryResult,
  AnalyzeRepositoryOptions,
} from "../../packages/engine/pipeline";
export type {
  DependencyGraph,
  GraphNode,
  GraphEdge,
  ModuleInfo,
  ParsedFile,
  RepositoryMeta,
  ScanSummary,
} from "../../packages/shared/types";
export { Repository } from "../../packages/repository/Repository";
export type { Rule, RuleViolation } from "../../packages/rules/RuleEngine";
