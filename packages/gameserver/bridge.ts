// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// bridge.ts — hubungkan `packages/gameserver` (jump gate) ke `packages/relay`
// (handoff lintas shard). Konsumen pertama relay + gameserver jadi satu.
//
// Alur (2 shard, D-005/D-009 self-host):
//
//   SHARD A                              SHARD B
//   ────────────────────────             ────────────────────────
//   vessel approach gate → transit()      (relay.deliver →)
//     → remove dari region A              → spawn vessel di region B
//     → notifyTarget → coordinator        → identity.move(A→B)
//        .requestHandoff (relay)          → ack {ok:true}
//
// PRINSIP: handoff TIDAK membawa source code (token anti-clone, D ship=code).
// Region tujuan mematerialkan VesselModel dari `vesselModels` (bridge) — di
// runtime nyata yang terpisah, shard tujuan materialkan dari source repo yang
// sudah didaftarkan pemain (vesselId + source → VesselModel). Bridge in-process
// menggantikan "shard tujuan punya source vessel" dengan map vesselId→model.

import type { Vec3, VesselEntity } from "./types";
import { WorldRegion } from "./world";
import { createGateRouter, type GateLink, type GateRouter } from "./gate";
import type { PersistenceStore } from "./persistence";
import {
  createGateCoordinator,
  type GateCoordinator,
  type DeliverFn,
} from "../relay/gate";
import type { RelayRegistry } from "../relay/registry";
import type { IdentityMap } from "../relay/identity";
import type { VesselModel } from "../universe/types";
import type { HandoffRequest, HandoffResult } from "../relay/types";

/** Satu shard yang ikut dalam bridge (1 region per shard utk sekarang). */
export interface GameBridgeShard {
  shardId: string;
  address: string;
  region: WorldRegion;
  /** Jump gate yang menghubungkan shard ini ke shard lain. */
  gateLinks: GateLink[];
}

export interface GameBridgeOptions {
  /** Relay registry bersama (di-share kedua shard). */
  registry: RelayRegistry;
  /** Identity lintas shard bersama. */
  identity: IdentityMap;
  /** Definisi vessel (VesselModel) per vesselId — materialized di shard tujuan. */
  vesselModels: Map<string, VesselModel>;
  /** Semua shard yang ikut bridge (agar deliver bisa spawn di mana saja). */
  shards: GameBridgeShard[];
  /** Opsional: persistence untuk handoff token crash-safe (diteruskan ke gate). */
  persistence?: PersistenceStore;
}

export interface GameBridgeShardRuntime {
  shard: GameBridgeShard;
  coordinator: GateCoordinator;
  router: GateRouter;
  /** pemain yang vessel-nya ada di shard ini + posisi entity (buat handoff). */
  vesselPositions: Map<string, Vec3>;
}

export interface GameBridge {
  /** Per-shard runtime (router + coordinator) — dipakai server tiap shard. */
  runtimes: Map<string, GameBridgeShardRuntime>;
  attachVessel(shardId: string, vessel: VesselEntity): void;
}

export function createGameBridge(opts: GameBridgeOptions): GameBridge {
  const runtimes = new Map<string, GameBridgeShardRuntime>();
  const pendingPositions = new Map<string, Vec3>();
  let seq = 0;

  // daftarkan & claim semua shard ke relay registry.
  for (const shard of opts.shards) {
    opts.registry.registerShard({
      shardId: shard.shardId,
      address: shard.address,
      regionIds: [shard.region.regionId],
      status: "up",
    });
    opts.registry.claimRegion(shard.region.regionId, shard.shardId);
  }

  // deliver hook: dipanggil relay utk mengirim vessel ke region tujuan.
  const deliver: DeliverFn = async (req: HandoffRequest, toShardId: string): Promise<HandoffResult> => {
    const shard = opts.shards.find((s) => s.shardId === toShardId);
    if (!shard) return { ok: false, reason: `unknown target shard ${toShardId}` };

    const model = opts.vesselModels.get(req.vesselId);
    if (!model) return { ok: false, reason: `no vessel model for ${req.vesselId}` };

    const position = pendingPositions.get(req.vesselId) ?? { x: 0, y: 0, z: 0 };
    shard.region.spawnVessel({
      id: req.vesselId,
      owner: req.transferToken.split(":")[2] ?? undefined,
      vessel: model,
      position,
    });

    // update presence lintas shard (asal → tujuan). playerId = token[2] lihat notifyTarget.
    const playerId = req.transferToken.split(":")[2] ?? "";
    opts.identity.move(playerId, req.fromShardId, req.toShardId, req.vesselId);

    pendingPositions.delete(req.vesselId);
    return { ok: true };
  };

  // bangun runtime per shard.
  for (const shard of opts.shards) {
    const coordinator = createGateCoordinator({
      registry: opts.registry,
      fromShardId: shard.shardId,
      deliver,
    });

    const router = createGateRouter(shard.gateLinks, {
      region: shard.region,
      persist: opts.persistence,
      notifyTarget: (targetRegionId, handoff) => {
        const toShard = coordinator.resolveTarget(targetRegionId);
        if (!toShard || toShard === shard.shardId) return; // target bukan shard ini / belum dikenal
        pendingPositions.set(handoff.vesselId, handoff.position);
        void coordinator.requestHandoff({
          vesselId: handoff.vesselId,
          fromRegionId: shard.region.regionId,
          fromShardId: shard.shardId,
          toRegionId: targetRegionId,
          toShardId: toShard,
          transferToken: `v:${handoff.vesselId}:${handoff.owner ?? ""}:${targetRegionId}`,
          seq: ++seq,
        });
      },
    });

    runtimes.set(shard.shardId, {
      shard,
      coordinator,
      router,
      vesselPositions: new Map(),
    });
  }

  return {
    runtimes,
    attachVessel(shardId, vessel) {
      const rt = runtimes.get(shardId);
      if (rt) {
        rt.vesselPositions.set(vessel.id, { ...vessel.position });
        opts.identity.attach(vessel.owner ?? "", { shardId, entityIds: [vessel.id], lastSeen: Date.now() });
      }
    },
  };
}
