// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// registry.ts — daftar shard server + claim region (mapping region → server).
//
// 🚧 SCAFFOLD — kerangka implementasi. Bagian jadi ditandai `// IMPL:`.
//
// Relay menjaga:
//   - `shards`: siapa yang online & alamatnya
//   - `claims`: region mana dipegang server mana (anti bentrok)

import type { RegionClaim, ShardRecord, ShardStatus } from "./types";

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
 * (lihat TODO(registry)[distributed]).
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

//
// §TODOS
//
// TODO(registry)[renew]     TTL claim + auto-release saat shard down/draining
// TODO(registry)[hb]        heartbeat: update status berdasarkan last-beat waktu nyata
// TODO(registry)[distributed] swap in-memory → packages/db (persisten lintas host)
// TODO(registry)[auth]      authorisasi claim (hanya pemilik self-host region)
// TODO(registry)[test]      smoke: dua shard claim beda region, bentrok ditolak, resolve bener
