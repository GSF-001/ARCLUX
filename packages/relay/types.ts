// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// packages/relay — SHARD REGISTRY + BRIDGE (D-005 multi-shard, D-009 self-host).
//
// Relay adalah pusat DAN BUKAN game server: ia hanya memetakan region → server,
// mengoordinasikan gate handoff, dan memegang identity lintas shard. Semua sim
// & keputusan combat tetap di gameserver tiap shard (self-host).

/** Satu instance shard server yang terdaftar di relay. */
export interface ShardRecord {
  /** id unik shard/server. */
  shardId: string;
  /** alamat jaringan (host:port) tempat gameserver berjalan. */
  address: string;
  /** wilayah (region) yang di-claim server ini (1..n). */
  regionIds: string[];
  /** health: "up" | "down" | "draining" (mulai stop, tak terima new vessel). */
  status: ShardStatus;
  /** metadata bebas (pemilik self-host, community, versi, dst). */
  meta?: Record<string, unknown>;
}

export type ShardStatus = "up" | "down" | "draining";

/** Claim: server meng-claim satu region supaya tidak bentrok 2 server. */
export interface RegionClaim {
  regionId: string;
  shardId: string;
  claimedAt: number;
  ttlMs?: number; // renewal; expire kalau server mati
}

/** Permintaan handoff vessel antar region milik server yang BEDA. */
export interface HandoffRequest {
  vesselId: string;
  fromRegionId: string;
  fromShardId: string;
  toRegionId: string;
  toShardId: string;
  /** token serah-terima — jangan bawa source code, bawa representation/token. */
  transferToken: string;
  seq: number;
}

export interface HandoffResult {
  ok: boolean;
  reason?: string;
}
