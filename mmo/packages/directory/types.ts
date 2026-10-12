// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// types.ts — ARCLUX Universe Directory types (Phase 1+2 live, DIRECTORY ≠ AUTHORITY).

export type Visibility = "public" | "community" | "private" | "organization" | "development";
export type FederationMode = "OFF" | "PRIVATE" | "PUBLIC" | "COMMUNITY";
export type ServerStatus = "ONLINE" | "DEGRADED" | "MAINTENANCE" | "OFFLINE";

export interface ServerManifest {
  serverId: string;
  name: string;
  endpoint: string;
  visibility: Visibility;
  version: string;
  regions: number;
  population?: number;
  federation: FederationMode;
  trustedPeers?: string[];
  gateAvailable?: boolean;
  community?: string;
  ruleset?: string;
  operator?: string;
  /** Shard environment (Sprint 6, 08 §4): "test" = shard publik terpisah ala
   *  EVE Singularity (data/wipe/dunia sendiri), "live" = produksi. Default live
   *  bila tidak disebut (manifest lama). */
  environment?: "live" | "test";
}

export interface ServerIdentity {
  serverId: string;
  publicKey?: string;
  version: string;
  protocolVersion: string;
  operator?: string;
}

export interface ServerHealth {
  serverId: string;
  status: ServerStatus;
  tickRate?: number;
  latencyMs?: number;
  population: number;
  regions: number;
  federation: FederationMode;
  updatedAt: string;
}
