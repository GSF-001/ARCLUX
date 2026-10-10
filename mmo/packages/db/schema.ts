// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// packages/db/ was 0% (no database dependency installed -- confirmed via
// package.json/node_modules, no sqlite/lowdb/knex/prisma/drizzle present,
// and this session has no network access to `pnpm add` one). Rather than
// write code against a library that isn't installed (unverifiable, same
// mistake as the VS Code extension caveat), this uses a JSON-file-per-record
// store through packages/storage/RecoveryManager.ts's writeTransactional()
// (the write-ahead journal already built and verified this session) --
// no new dependency, works today, crash-safe by construction.
//
// SCHEMA_VERSION exists so a future real SQL migration can detect "this
// repo has old JSON-store data" and write a one-time importer, instead of
// silently ignoring it.

export const SCHEMA_VERSION = 1;

export interface RepoRecord {
  id: string;
  org: string;
  name: string;
  defaultBranch: string;
  rootPath: string;
  detectedFrameworks: string[];
  packageManager: "npm" | "pnpm" | "yarn" | "poetry" | "uv" | "pipenv" | "pdm" | "pip" | "unknown";
  analyzedAt: string;
}

export interface AnalysisRecord {
  id: string;
  repoId: string;
  moduleCount: number;
  nodeCount: number;
  edgeCount: number;
  analyzedAt: string;
}

export interface IssueRecord {
  id: string;
  repoId: string;
  analysisId: string;
  source: "detector" | "rule";
  checkId: string;
  severity: "error" | "warning";
  message: string;
  createdAt: string;
}

/**
 * Persistent region world state (gameserver). Holds a serialized RegionSnapshot
 * for server restart ≠ world reset (V6 / D-013) and cross-shard handoff recovery.
 * `snapshot` is the opaque RegionSnapshot payload from packages/gameserver.
 */
export interface RegionRecord {
  id: string;
  /** mirror of snapshot.regionId (kept for indexed/consistent lookups). */
  regionId: string;
  /** snapshot payload (gameserver RegionSnapshot) — fully serializable. */
  snapshot: unknown;
  /** last successful save timestamp (crash-safe "last-good" pointer). */
  updatedAt: string;
}

/**
 * Pending jump-gate handoff (gameserver). Persisted BEFORE the vessel is removed
 * from the origin region and BEFORE the target is notified, so a crash mid-transit
 * cannot lose the vessel — recovery re-delivers leftover handoffs (crash-safe,
 * D-009 self-host / D-013 restart≠reset).
 */
export interface PendingHandoffRecord {
  id: string;
  /** origin region id (the shard that owns the vessel). */
  fromRegionId: string;
  /** id region tujuan (milik shard/server lain). */
  toRegionId: string;
  /** gate id tempat transit dimulai. */
  gateId: string;
  /** handoff payload (gameserver GateTransitResult.handoff) — fully serializable. */
  handoff: unknown;
  /** kapan transit di-start (untuk audit/recovery TTL). */
  startedAt: string;
  /** updatedAt alias — crash-safe "last-good" pointer. */
  updatedAt: string;
}

/**
 * Relay shard registry (Sprint 4 / P0-6) — relay adalah registry TERPUSAT:
 * 1 proses per region, daftar shard + claim region persist ke sini (bukan
 * Map in-memory yang hilang saat relay restart).
 */
export interface RelayShardRecord {
  id: string; // = shardId
  shardId: string;
  address: string;
  regionIds: string[];
  status: "up" | "down" | "draining";
  meta?: Record<string, unknown>;
  updatedAt: string;
}

/** Claim region → shard (anti bentrok 2 server). id = regionId. */
export interface RelayClaimRecord {
  id: string; // = regionId
  regionId: string;
  shardId: string;
  claimedAt: number;
  ttlMs?: number;
}

/** Identity lintas shard persist (Sprint 4) — id = playerId (global handle). */
export interface RelayIdentityRecord {
  id: string; // = playerId
  presence: Array<{ shardId: string; entityIds: string[]; lastSeen: number }>;
}

/**
 * Event record handoff lintas shard (Sprint 4) — append-only audit trail:
 * requested/delivered/rejected + seq (sumber rehydrate lastSeq idempotency
 * setelah relay restart — event-sourced, bukan Map terpisah).
 */
export interface RelayEventRecord {
  id: string;
  /** idempotency key `${vesselId}:${toRegionId}` (mirror relay/gate). */
  key: string;
  type: "requested" | "delivered" | "rejected";
  vesselId: string;
  fromShardId: string;
  toShardId: string;
  toRegionId: string;
  seq: number;
  ok: boolean;
  reason?: string;
  at: string;
}

export type CollectionName =
  | "repos"
  | "analyses"
  | "issues"
  | "regions"
  | "handoffs"
  | "relayShards"
  | "relayClaims"
  | "relayIdentities"
  | "relayEvents";
