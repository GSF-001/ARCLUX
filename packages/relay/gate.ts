// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// gate.ts — koordinasi handoff vessel antar region milik server yang BEDA.
//
// Alur (melengkapi packages/gameserver/gate.ts yang ngurus sisi server lokal):
//
// ```
// server A (gameserver.gate.transit)
//   → relay.gate.requestHandoff({vesselId, fromShardId, toRegionId, token})
//   → relay temukan toShardId via registry.resolveRegion(toRegionId)
//   → relay forward request ke server B (via deliver hook)
//   → server B: validasi token → spawn vessel → ack
//   → relay return HandoffResult ke server A
// ```
//
// Indempotency: relay melacak seq per vessel. Seq yang berulang/stale ditolak
// supaya transmisi/retry gak dobel-spawn vessel di tujuan (TODO(gate)[seq] selesai).

import type { HandoffRequest, HandoffResult } from "./types";
import type { RelayRegistry } from "./registry";

/** Hook transport ke server tujuan; di-inject oleh caller (socket/HTTP/gRPC). */
export type DeliverFn = (req: HandoffRequest, toShardId: string, toAddress: string) => Promise<HandoffResult>;

export interface GateCoordinator {
  requestHandoff(req: HandoffRequest): Promise<HandoffResult>;
  /** resolusi manual: region tujuan → shard mana (bantu debug & test). */
  resolveTarget(regionId: string): string | undefined;
}

export interface GateCoordinatorOptions {
  registry: RelayRegistry;
  /** alamat pengirim (relay tahu server A). */
  fromShardId: string;
  /** hook pengiriman ke server tujuan — WAJIB ada di runtime nyata. */
  deliver?: DeliverFn;
}

/** Token handoff TIDAK boleh membawa source code (D basis: ship = code, anti-clone).
 *  Cek heuristik sederhana: non-kosong & tanpa pola kode umum. */
function sanitizeToken(token: string): { ok: boolean; reason?: string } {
  if (!token || token.trim().length === 0) {
    return { ok: false, reason: "transfer token kosong" };
  }
  const codeSmells = ["import ", "function ", "=>", "{", "}", ";", "class ", "const ", "let "];
  for (const s of codeSmells) {
    if (token.includes(s)) {
      return { ok: false, reason: "transfer token tampak membawa konten kode (anti-clone) — pakai representasi/token, bukan source" };
    }
  }
  return { ok: true };
}

export function createGateCoordinator(opts: GateCoordinatorOptions): GateCoordinator {
  const lastSeq = new Map<string, number>();

  const resolveTarget = (regionId: string) => {
    const s = opts.registry.resolveRegion(regionId);
    return s?.shardId;
  };

  const requestHandoff: GateCoordinator["requestHandoff"] = async (req) => {
    // 1. otorisasi: pengirim harus dari shard yang sama dengan fromShardId request.
    if (req.fromShardId !== opts.fromShardId) {
      return { ok: false, reason: `fromShardId mismatch: relay is ${opts.fromShardId}, req says ${req.fromShardId}` };
    }

    // 2. token anti-clone: bukan source code.
    const tok = sanitizeToken(req.transferToken);
    if (!tok.ok) return { ok: false, reason: tok.reason };

    // 3. resolve region tujuan → shard.
    const toShard = resolveTarget(req.toRegionId);
    if (!toShard) return { ok: false, reason: `no shard claims ${req.toRegionId}` };
    const toShardRec = opts.registry.getShard(toShard);
    if (!toShardRec) return { ok: false, reason: `target shard ${toShard} not registered` };

    // 4. idempotency: cegah dobel-spawn dari seq berulang/stale.
    const key = `${req.vesselId}:${req.toRegionId}`;
    const prev = lastSeq.get(key);
    if (prev !== undefined && req.seq <= prev) {
      return { ok: false, reason: `stale/duplicate seq ${req.seq} (last ${prev}) — handoff already in flight` };
    }

    // 5. kirim ke server tujuan lewat deliver hook.
    if (!opts.deliver) {
      return { ok: false, reason: "no deliver hook configured — cannot reach target shard" };
    }
    const result = await opts.deliver(req, toShard, toShardRec.address);
    if (result.ok) {
      lastSeq.set(key, req.seq); // hanya naik kalau sukses (retry naik seq tetap dibolehkan)
    }
    return result;
  };

  return { requestHandoff, resolveTarget };
}

//
// §TODOS
//
// TODO(gate)[token]     perkuat transferToken (sign/cryptographic) — sekarang heuristik minimal
// TODO(gate)[crash]     simpan in-flight handoff → recovery kalau server A/B mati tengah
// TODO(gate)[event]     record world/gate event (blueprint 06 §14) di kedua region
// TODO(gate)[test]      smoke: A→B handoff, simulasikan ack & reject path
