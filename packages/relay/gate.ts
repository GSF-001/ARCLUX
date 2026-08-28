// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// gate.ts — koordinasi handoff vessel antar region milik server yang BEDA.
//
// 🚧 SCAFFOLD — kerangka implementasi. Bagian jadi ditandai `// IMPL:`.
//
// Alur (melengkapi packages/gameserver/gate.ts yang ngurus sisi server lokal):
//
// ```
// server A (gameserver.gate.transit)
//   → relay.gate.requestHandoff({vesselId, fromShardId, toRegionId, token})
//   → relay temukan toShardId via registry.resolveRegion(toRegionId)
//   → relay forward request ke server B (via hook/endpoint, IMPL)
//   → server B: validasi token → spawn vessel → ack
//   → relay return HandoffResult ke server A
// ```

import type { HandoffRequest, HandoffResult } from "./types";
import type { RelayRegistry } from "./registry";

export interface GateCoordinator {
  requestHandoff(req: HandoffRequest): Promise<HandoffResult>;
  /** resolusi manual: region tujuan → shard mana (bantu debug & test). */
  resolveTarget(regionId: string): string | undefined;
}

export interface GateCoordinatorOptions {
  registry: RelayRegistry;
  /** alamat pengirim (relay tahu server A). */
  fromShardId: string;
}

/**
 * 🚧 Koordinator in-process: resolusi lewat registry + validasi token minimal.
 * Transport aktual ke server tujuan (network) dimasukkan via `deliver` hook
 * (TODO(gate)[deliver]).
 */
export function createGateCoordinator(opts: GateCoordinatorOptions): GateCoordinator {
  const resolveTarget = (regionId: string) => {
    const s = opts.registry.resolveRegion(regionId);
    return s?.shardId;
  };

  const requestHandoff: GateCoordinator["requestHandoff"] = async (req) => {
    const toShard = resolveTarget(req.toRegionId);
    if (!toShard) return { ok: false, reason: `no shard claims ${req.toRegionId}` };

    // IMPL(gate): validasi — token bukan source code, req.seq konsisten, fromShardId cocok
    // IMPL(gate): kirim ke server tujuan via socket/HOOK (lihat TODO(gate)[deliver])
    // IMPL(gate): server tujuan spawn vessel (gameserver) → ack kalau berhasil
    return { ok: false, reason: "delivery to target shard not implemented (scaffold)" };
  };

  return { requestHandoff, resolveTarget };
}

//
// §TODOS
//
// TODO(gate)[deliver]   hook transport ke server tujuan (WebSocket/gRPC) — `deliver(req, addr)`
// TODO(gate)[token]     buat/verifikasi transferToken (anti forgery) — bukan source code
// TODO(gate)[seq]       ordering & idempotency (retry handoff gak dobel-spawn)
// TODO(gate)[crash]     simpan in-flight handoff → recovery kalau server A/B mati tengah
// TODO(gate)[event]     record world/gate event (blueprint 06 §14) di kedua region
// TODO(gate)[test]      smoke: A→B handoff, simulasikan ack & reject path
