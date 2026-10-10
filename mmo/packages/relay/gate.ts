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

import type { HandoffRequest, HandoffResult } from "./types";
import type { RelayRegistry } from "./registry";
import type { HandoffLedger } from "./handoffLedger";

/** Hook transport ke server tujuan; di-inject oleh caller (socket/HTTP/gRPC). */
export type DeliverFn = (req: HandoffRequest, toShardId: string, toAddress: string) => Promise<HandoffResult>;

export interface GateCoordinator {
  requestHandoff(req: HandoffRequest): Promise<HandoffResult>;
  /** resolusi manual: region tujuan → shard mana (bantu debug & test). */
  resolveTarget(regionId: string): string | undefined;
}

/** Event koordinator (audit observability — E-5 tidak berlaku: bukan sim path). */
export interface RelayCoordinatorEvent {
  type: "handoff.requested" | "handoff.delivered" | "handoff.rejected";
  vesselId: string;
  fromShardId: string;
  toShardId: string;
  toRegionId: string;
  seq: number;
  ok: boolean;
  reason?: string;
}

export interface GateCoordinatorOptions {
  registry: RelayRegistry;
  /** alamat pengirim (relay tahu server A). */
  fromShardId: string;
  /** hook pengiriman ke server tujuan — WAJIB ada di runtime nyata. */
  deliver?: DeliverFn;
  /**
   * Verifier token handoff CRYPTOGRAPHIC (Sprint 4 — Ed25519, lihat
   * handoffToken.ts). Bila di-set, menggantikan sanitizeToken heuristik
   * (P0-6: heuristik bisa dibobol string tanpa substring terlarang).
   */
  verifyToken?: (token: string) => { ok: boolean; reason?: string };
  /**
   * Ledger event + lastSeq idempotency persist (Sprint 4). Bila di-set,
   * stale-seq check bertahan setiap relay restart (event-sourced).
   */
  ledger?: HandoffLedger;
  /** Emit event koordinator (observability). */
  onEvent?: (ev: RelayCoordinatorEvent) => void;
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
  // lastSeq: dari ledger (persist) bila ada, else Map in-memory (legacy).
  // Ledger bersifat event-sourced: lastSeq naik saat event "delivered" di-append.
  const lastSeqMem = new Map<string, number>();
  const lastSeqOf = (key: string): number | undefined =>
    opts.ledger ? opts.ledger.lastSeq(key) : lastSeqMem.get(key);
  const markSeq = (key: string, seq: number) => {
    if (!opts.ledger) lastSeqMem.set(key, seq);
  };

  const resolveTarget = (regionId: string) => {
    const s = opts.registry.resolveRegion(regionId);
    return s?.shardId;
  };

  const requestHandoff: GateCoordinator["requestHandoff"] = async (req) => {
    const emit = (type: RelayCoordinatorEvent["type"], ok: boolean, reason?: string, toShardId = req.toShardId) => {
      const ev = { type, vesselId: req.vesselId, fromShardId: req.fromShardId, toShardId, toRegionId: req.toRegionId, seq: req.seq, ok, reason };
      opts.onEvent?.(ev);
      const ledgerType = type === "handoff.requested" ? "requested" : type === "handoff.delivered" ? "delivered" : "rejected";
      opts.ledger?.append({ ...ev, type: ledgerType, key: `${req.vesselId}:${req.toRegionId}` });
    };

    // 1. otorisasi: pengirim harus dari shard yang sama dengan fromShardId request.
    if (req.fromShardId !== opts.fromShardId) {
      return { ok: false, reason: `fromShardId mismatch: relay is ${opts.fromShardId}, req says ${req.fromShardId}` };
    }

    // 2. token: cryptographic (verifyToken — Ed25519) bila dikonfigurasi,
    //    else legacy heuristik (self-host lama / 1 proses).
    const tok = opts.verifyToken
      ? opts.verifyToken(req.transferToken)
      : sanitizeToken(req.transferToken);
    if (!tok.ok) {
      emit("handoff.rejected", false, tok.reason);
      return { ok: false, reason: tok.reason };
    }

    // 3. resolve region tujuan → shard.
    const toShard = resolveTarget(req.toRegionId);
    if (!toShard) {
      emit("handoff.rejected", false, `no shard claims ${req.toRegionId}`);
      return { ok: false, reason: `no shard claims ${req.toRegionId}` };
    }
    const toShardRec = opts.registry.getShard(toShard);
    if (!toShardRec) {
      emit("handoff.rejected", false, `target shard ${toShard} not registered`, toShard);
      return { ok: false, reason: `target shard ${toShard} not registered` };
    }

    // 4. idempotency: cegah dobel-spawn dari seq berulang/stale.
    const key = `${req.vesselId}:${req.toRegionId}`;
    const prev = lastSeqOf(key);
    if (prev !== undefined && req.seq <= prev) {
      emit("handoff.rejected", false, `stale/duplicate seq ${req.seq} (last ${prev}) — handoff already in flight`, toShard);
      return { ok: false, reason: `stale/duplicate seq ${req.seq} (last ${prev}) — handoff already in flight` };
    }

    // 5. kirim ke server tujuan lewat deliver hook.
    if (!opts.deliver) {
      emit("handoff.rejected", false, "no deliver hook configured — cannot reach target shard", toShard);
      return { ok: false, reason: "no deliver hook configured — cannot reach target shard" };
    }
    emit("handoff.requested", true, undefined, toShard);
    const result = await opts.deliver(req, toShard, toShardRec.address);
    if (result.ok) {
      markSeq(key, req.seq); // hanya naik kalau sukses (retry naik seq tetap dibolehkan)
    }
    emit(result.ok ? "handoff.delivered" : "handoff.rejected", result.ok, result.reason, toShard);
    return result;
  };

  return { requestHandoff, resolveTarget };
}

//
// Live — persist/relay/event wired, verified smoke (PR #590/#591).