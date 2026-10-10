// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// registry.ts — daftar shard server + claim region (mapping region → server).
//
// 🚧 SCAFFOLD — kerangka implementasi. Bagian jadi ditandai `// IMPL:`.
//
// Relay menjaga:
//   - `shards`: siapa yang online & alamatnya
//   - `claims`: region mana dipegang server mana (anti bentrok)

import type { RegionClaim, ShardRecord, ShardStatus } from "./types";
import {
  putRelayShard,
  deleteRelayShard,
  listRelayShards,
  putRelayClaim,
  deleteRelayClaim,
  listRelayClaims,
} from "../db/repositories/RelayStore";

export interface RelayRegistry {
  registerShard(shard: ShardRecord): void;
  unregisterShard(shardId: string): void;
  setShardStatus(shardId: string, status: ShardStatus): void;
  listShards(): ShardRecord[];
  getShard(shardId: string): ShardRecord | undefined;

  claimRegion(regionId: string, shardId: string): boolean;
  releaseRegion(regionId: string, shardId: string): boolean;
  resolveRegion(regionId: string): ShardRecord | undefined;
}

/**
 * 🚧 In-memory registry — jalurnya pass utk 1 proses (prototype/self-host).
 * Saat multi-process, ganti state ke pakai packages/db atau key-value terpusat
 */
export function createRelayRegistry(): RelayRegistry {
  const shards = new Map<string, ShardRecord>();
  const claims = new Map<string, RegionClaim>();

  const registerShard = (shard: ShardRecord) => {
    shards.set(shard.shardId, { ...shard });
  };
  const unregisterShard = (shardId: string) => {
    for (const [regionId, c] of claims) if (c.shardId === shardId) claims.delete(regionId);
    shards.delete(shardId);
  };
  const listShards = () => [...shards.values()];
  const getShard = (shardId: string) => shards.get(shardId);

  const claimRegion = (regionId: string, shardId: string) => {
    // shard HARUS sudah register dulu sebelum boleh men-claim (anti bentrok &
    // konsistensi: claim yang tersimpan harus selalu menunjuk shard yang valid).
    if (!shards.has(shardId)) return false;
    const existing = claims.get(regionId);
    if (existing && existing.shardId !== shardId) return false; // dipegang server lain
    claims.set(regionId, { regionId, shardId, claimedAt: Date.now() });
    return true;
  };
  const releaseRegion = (regionId: string, shardId: string) => {
    const c = claims.get(regionId);
    if (!c || c.shardId !== shardId) return false;
    claims.delete(regionId);
    return true;
  };
  const resolveRegion = (regionId: string) => {
    const c = claims.get(regionId);
    return c ? shards.get(c.shardId) : undefined;
  };

  return {
    registerShard,
    unregisterShard,
    setShardStatus: (shardId, status) => {
      const s = shards.get(shardId);
      if (s) s.status = status;
    },
    listShards,
    getShard,
    claimRegion,
    releaseRegion,
    resolveRegion,
  };
}

/**
 * Live — registry PERSIST ke packages/db (Sprint 4 / P0-6): relay adalah
 * registry terpusat untuk topology 1-proses-per-region. Mutasi di-mirror ke
 * store (sync fs) + state di-hydrate saat create → relay restart ≠ registry
 * hilang. Interface sama dengan createRelayRegistry (drop-in).
 */
export function createPersistentRelayRegistry(): RelayRegistry {
  const mem = createRelayRegistry();

  // hydrate dari disk (shard dulu — claim butuh shard terdaftar).
  for (const s of listRelayShards()) {
    mem.registerShard({
      shardId: s.shardId,
      address: s.address,
      regionIds: [...s.regionIds],
      status: s.status,
      meta: s.meta,
    });
  }
  for (const c of listRelayClaims()) {
    mem.claimRegion(c.regionId, c.shardId);
  }

  const persistShard = (shardId: string) => {
    const s = mem.getShard(shardId);
    if (!s) return;
    putRelayShard({
      id: s.shardId,
      shardId: s.shardId,
      address: s.address,
      regionIds: [...s.regionIds],
      status: s.status,
      meta: s.meta,
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    registerShard(shard) {
      mem.registerShard(shard);
      persistShard(shard.shardId);
    },
    unregisterShard(shardId) {
      mem.unregisterShard(shardId);
      deleteRelayShard(shardId);
      // claims milik shard ini sudah dihapus dari mem; bersihkan dari disk juga.
      for (const c of listRelayClaims()) {
        if (c.shardId === shardId) deleteRelayClaim(c.regionId);
      }
    },
    setShardStatus(shardId, status) {
      mem.setShardStatus(shardId, status);
      persistShard(shardId);
    },
    listShards: () => mem.listShards(),
    getShard: (shardId) => mem.getShard(shardId),
    claimRegion(regionId, shardId) {
      const ok = mem.claimRegion(regionId, shardId);
      if (ok) putRelayClaim({ id: regionId, regionId, shardId, claimedAt: Date.now() });
      return ok;
    },
    releaseRegion(regionId, shardId) {
      const ok = mem.releaseRegion(regionId, shardId);
      if (ok) deleteRelayClaim(regionId);
      return ok;
    },
    resolveRegion: (regionId) => mem.resolveRegion(regionId),
  };
}

//
// Live — persist/relay/event wired, verified smoke (PR #590/#591).