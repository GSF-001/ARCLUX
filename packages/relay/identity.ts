// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// identity.ts — pemetaan player id lintas shard (global handle → per-shard entity).
//
// 🚧 SCAFFOLD — kerangka implementasi. Bagian jadi ditandai `// IMPL:`.
//
// Karena multi-shard (D-005), satu pemain bisa punya entity di beberapa region
// sekaligus. Relay memegang pemetaan global:
//
// ```
// playerId (global) → [{shardId, entityId(s)}, ...]
// ```
//
// Ini dipakai untuk: routing intent antar shard, pasangan di gate handoff,
// dan mencari entity pemain di region lain.

export interface ShardPresence {
  shardId: string;
  entityIds: string[];
  lastSeen: number;
}

export interface IdentityMap {
  attach(playerId: string, presence: ShardPresence): void;
  detach(playerId: string, shardId: string): void;
  resolve(playerId: string): ShardPresence[];
  has(playerId: string): boolean;
}

/**
 * 🚧 In-memory map. Untuk self-host skala kecil cukup; pemetaan persisten /
 * lintas-host → pakai packages/db (TODO(identity)[persist]).
 */
export function createIdentityMap(): IdentityMap {
  const map = new Map<string, ShardPresence[]>();

  const attach = (playerId: string, presence: ShardPresence) => {
    const list = map.get(playerId) ?? [];
    const i = list.findIndex((p) => p.shardId === presence.shardId);
    if (i >= 0) list[i] = presence;
    else list.push(presence);
    map.set(playerId, list);
  };
  const detach = (playerId: string, shardId: string) => {
    const list = map.get(playerId);
    if (!list) return;
    const next = list.filter((p) => p.shardId !== shardId);
    if (next.length) map.set(playerId, next);
    else map.delete(playerId);
  };
  const resolve = (playerId: string) => map.get(playerId) ?? [];
  const has = (playerId: string) => map.has(playerId);

  return { attach, detach, resolve, has };
}

//
// §TODOS
//
// TODO(identity)[persist]   simpan map ke packages/db (recovery saat relay restart)
// TODO(identity)[auth]      verifikasi player id asli (bukan spoof) sebelum attach
// TODO(identity)[gate]      saat handoff, update presence di shard asal & tujuan
// TODO(identity)[test]      smoke: attach 2 shard, resolve bener, detach satu bersih
