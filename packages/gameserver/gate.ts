// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// gate.ts — Jump Gate routing & handoff antar region (D-006: Region + Gates).
//
// 🚧 SCAFFOLD — kerangka implementasi, BELUM berfungsi penuh. Bagian yang jadi
// ditandai `// IMPL:` dengan deskripsi; TODO list di bawah §TODOS.
//
// Lifecycle yang mau dicapai (eksplisit dulu, seamless di fase berikutnya):
//
// ```
// GATE REGION A (server A)                 GATE REGION B (server B)
// ───────────────────────                  ───────────────────────
// vessel approach gate → intent IN → relay notifies B → B claims vessel
//   ↘ entity removed from A                     ↙ vessel spawned in B
//        HANDOFF ACK        (persisted via recovery / relay handshake)
// ```
//
// Prinsip: handoff vessel antar region = transfer kepemilikan sim, WAJIB lewat
// jalur resmi relay/gate — bukan mutasi langsung state region lain (self-host,
// D-009). Server tidak bisa mengubah authoritative state milik server lain.

import type { ComponentBinding } from "../universe/types";
import type { PlayerIntent, Vec3 } from "./types";

/** Deskripsi satu jump gate yang menghubungkan region ini ke region lain. */
export interface GateLink {
  /** id unik gate. */
  id: string;
  /** id region lokal tempat gate berada. */
  localRegionId: string;
  /** id region tujuan (milik shard/server lain). */
  targetRegionId: string;
  /** posisi gate di region lokal. */
  position: Vec3;
  /** radius aktivasi (vessel yang mendekat dalam radius ini dapat transit). */
  activationRadius: number;
  /** otorisasi: komunitas yang boleh transit (kosong = publik). */
  allowedCommunityIds: string[];
}

/** Permintaan transit vessel lewat gate (dikirim ke relay/gate handler). */
export interface GateTransitRequest {
  gateId: string;
  vesselId: string;
  targetRegionId: string;
  requestedBy: string; // player id yang mengarahkan vessel
  expectedArrival: Vec3;
}

/** Hasil handoff: berhasil bawa vessel ke region tujuan, atau ditolak. */
export interface GateTransitResult {
  ok: boolean;
  reason?: string;
  /** kalau ok, data minimal untuk region tujuan men-spawn vessel. */
  handoff?: {
    vesselId: string;
    owner: string;
    // IMPL: initial WorldState + VesselModel snapshot dibawa ke region tujuan.
    //       JANGAN bawa seluruh code — bawa representation/token, bukan source.
    position: Vec3;
    hubId?: string;
  };
}

export interface GateRouter {
  transit(req: GateTransitRequest): Promise<GateTransitResult>;
}

/**
 * 🚧 Deterministik gate: vessel yang ada dalam activationRadius & berhak
 * transit (allowedCommunityIds) dilepas dari region lokal, lalu diminta
 * region tujuan men-spawn. Belum ada transport (relay/netcode) — IMPL pakai
 * relay ketika tersedia.
 */
export function createGateRouter(links: GateLink[]): GateRouter {
  // IMPL:
  //  - cari link by gateId & targetRegionId
  //  - cek allowedCommunityIds vs pemilik vessel/community
  //  - validasi posisi vessel dalam activationRadius
  //  - remove vessel dari region lokal (world.removeVessel)
  //  - notify relay (registry.gate) → region tujuan spawn
  //  - return GateTransitResult
  const transit: GateRouter["transit"] = async (req) => {
    const link = links.find(
      (l) => l.id === req.gateId && l.targetRegionId === req.targetRegionId,
    );
    if (!link) {
      return { ok: false, reason: `gate ${req.gateId} -> ${req.targetRegionId} not found` };
    }
    // TODO: implementasi validasi radius + otorisasi + handoff (lihat TODOS).
    return { ok: false, reason: "not implemented (scaffold)" };
  };

  return { transit };
}

//
// §TODOS — tinggal isi satu per satu, update check saat selesai
//
// TODO(gate)[handoff] implementasi transit(): validasi radius + community + remove vessel
// TODO(gate)[relay]   hubungkan ke packages/relay untuk notifikasi region tujuan
// TODO(gate)[persist] simpan handoff token ke persistence sebelum region tujuan spawn (crash-safe)
// TODO(gate)[event]   emit world event `gate.transit.start` / `gate.transit.complete` (blueprint 06 §14)
// TODO(gate)[test]    smoke test: dua region, transit vessel, pastikan muncul di tujuan & hilang di asal
