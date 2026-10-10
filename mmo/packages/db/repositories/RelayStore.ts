// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// RelayStore — CRUD koleksi relay (Sprint 4 / P0-6): shards, claims,
// identities, handoff events. Semua lewat client.ts (JSON-per-record +
// writeTransactional — crash-safe, sama dengan stores lain).
// Sync (fs) — cocok dengan interface relay yang sync.

import { putRecord, getRecord, listRecords, deleteRecord } from "../client";
import type {
  RelayClaimRecord,
  RelayEventRecord,
  RelayIdentityRecord,
  RelayShardRecord,
} from "../schema";

// ── shards ──────────────────────────────────────────────────────────────

export function putRelayShard(rec: RelayShardRecord): void {
  putRecord("relayShards", rec);
}

export function getRelayShard(shardId: string): RelayShardRecord | null {
  return getRecord<RelayShardRecord>("relayShards", shardId);
}

export function listRelayShards(): RelayShardRecord[] {
  return listRecords<RelayShardRecord>("relayShards");
}

export function deleteRelayShard(shardId: string): void {
  deleteRecord("relayShards", shardId);
}

// ── claims ──────────────────────────────────────────────────────────────

export function putRelayClaim(rec: RelayClaimRecord): void {
  putRecord("relayClaims", rec);
}

export function getRelayClaim(regionId: string): RelayClaimRecord | null {
  return getRecord<RelayClaimRecord>("relayClaims", regionId);
}

export function listRelayClaims(): RelayClaimRecord[] {
  return listRecords<RelayClaimRecord>("relayClaims");
}

export function deleteRelayClaim(regionId: string): void {
  deleteRecord("relayClaims", regionId);
}

// ── identities ──────────────────────────────────────────────────────────

export function putRelayIdentity(rec: RelayIdentityRecord): void {
  putRecord("relayIdentities", rec);
}

export function getRelayIdentity(playerId: string): RelayIdentityRecord | null {
  return getRecord<RelayIdentityRecord>("relayIdentities", playerId);
}

export function listRelayIdentities(): RelayIdentityRecord[] {
  return listRecords<RelayIdentityRecord>("relayIdentities");
}

export function deleteRelayIdentity(playerId: string): void {
  deleteRecord("relayIdentities", playerId);
}

// ── handoff events (append-only) ────────────────────────────────────────

let eventCounter = 0;

export function appendRelayEvent(
  ev: Omit<RelayEventRecord, "id" | "at">,
): RelayEventRecord {
  // id unik: waktu + counter monotonic per proses (audit trail, bukan sim path
  // — Date.now/crypto.randomUUID halal di sini, E-5 hanya untuk sim).
  const id = `${Date.now()}-${process.pid}-${++eventCounter}`;
  const rec: RelayEventRecord = { ...ev, id, at: new Date().toISOString() };
  putRecord("relayEvents", rec);
  return rec;
}

export function listRelayEvents(): RelayEventRecord[] {
  return listRecords<RelayEventRecord>("relayEvents");
}
