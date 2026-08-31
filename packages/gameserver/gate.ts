// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// gate.ts — Jump Gate routing & handoff antar region (D-006: Region + Gates).
//
// Lifecycle (eksplisit dulu, seamless di fase berikutnya):
//
//   GATE REGION A (server A)                 GATE REGION B (server B)
//   ───────────────────────                  ───────────────────────
//   vessel approach gate → intent transit → notifyTarget(B) → B spawns vessel
//     ↘ entity removed from A                    ↙ vessel spawned in B
//          HANDOFF     (token via callback / persistence crash-safe)
//
// Prinsip: handoff vessel antar region = transfer kepemilikan sim, WAJIB lewat
// jalur resmi relay/gate — bukan mutasi langsung state region lain (self-host,
// D-009). Server tidak bisa mengubah authoritative state milik server lain.

import type { Vec3, VesselEntity } from "./types";
import { WorldRegion } from "./world";
import type { PersistenceStore, PendingHandoff } from "./persistence";

/** Jarak euclidean antara dua titik (meter). */
function vecDist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

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
  requestedBy: string;
}

/** Hasil handoff: berhasil bawa vessel ke region tujuan, atau ditolak. */
export interface GateTransitResult {
  ok: boolean;
  reason?: string;
  /** kalau ok, data minimal untuk region tujuan men-spawn vessel. */
  handoff?: {
    vesselId: string;
    owner?: string;
    position: Vec3;
    hubId?: string;
  };
}

/** Event gate yang dipancarkan (blueprint 06 §14 governance/world event). */
export interface GateEvent {
  type: "gate.transit.start" | "gate.transit.complete" | "gate.transit.reject";
  gateId: string;
  regionId: string;
  targetRegionId: string;
  vesselId: string;
  actorId?: string;
  payload: Record<string, unknown>;
}

export interface GateRouterDeps {
  /** Region lokal (server yang memiliki gate & vessel). */
  region: WorldRegion;
  /** Directory lookup (DIRECTORY ≠ AUTHORITY) — cek federation/trustedPeers. */
  directory?: { getServer: (id: string) => { manifest?: import("../directory/types").ServerManifest } };
  /** Notify region tujuan (via relay) untuk men-spawn vessel. */
  notifyTarget?: (targetRegionId: string, handoff: NonNullable<GateTransitResult["handoff"]>) => void;
  /** Emit world event (gate.transit.*). */
  onEvent?: (ev: GateEvent) => void;
  /** Opsional: hub entity/faction lookup untuk otorisasi lanjutan. */
  resolveFaction?: (vesselId: string) => string | undefined;
  /** Opsional: persistence untuk handoff token crash-safe (kalau ada). */
  persist?: PersistenceStore;
}

/** Ambil reference vessel kering (id, posisi) untuk handoff tanpa bawa state hidup. */
function toHandoff(vessel: VesselEntity): NonNullable<GateTransitResult["handoff"]> {
  return {
    vesselId: vessel.id,
    owner: vessel.owner,
    position: { ...vessel.position },
  };
}

/** Cek otorisasi community: kosong = publik; else owner/faction harus termasuk. */
function authorized(link: GateLink, vessel: VesselEntity, faction?: string): boolean {
  if (link.allowedCommunityIds.length === 0) return true;
  return (
    (!!vessel.owner && link.allowedCommunityIds.includes(vessel.owner)) ||
    (!!faction && link.allowedCommunityIds.includes(faction))
  );
}

export interface GateRouter {
  transit(req: GateTransitRequest): Promise<GateTransitResult>;
  /**
   * Recovery crash-safe (D-013 restart ≠ reset): muat semua pending handoff yang
   * tersisa dari crash dan re-deliver ke region tujuan. Kembalikan jumlah yang
   * berhasil di-resume.
   */
  recoverPendingHandoffs(): Promise<number>;
}

export function createGateRouter(links: GateLink[], deps: GateRouterDeps): GateRouter {
  const transit: GateRouter["transit"] = async (req) => {
    const link = links.find(
      (l) => l.id === req.gateId && l.targetRegionId === req.targetRegionId,
    );
    if (!link) {
      return { ok: false, reason: `gate ${req.gateId} -> ${req.targetRegionId} not found` };
    }

    const vessel = deps.region.getVessel(req.vesselId);
    if (!vessel) {
      deps.onEvent?.({
        type: "gate.transit.reject",
        gateId: req.gateId,
        regionId: deps.region.regionId,
        targetRegionId: req.targetRegionId,
        vesselId: req.vesselId,
        actorId: req.requestedBy,
        payload: { reason: "vessel not found" },
      });
      return { ok: false, reason: "vessel not found in region" };
    }

    // validasi radius aktivasi (jarak vessel ke gate).
    if (vecDist(link.position, vessel.position) > link.activationRadius) {
      deps.onEvent?.({
        type: "gate.transit.reject",
        gateId: req.gateId,
        regionId: deps.region.regionId,
        targetRegionId: req.targetRegionId,
        vesselId: req.vesselId,
        actorId: req.requestedBy,
        payload: { reason: "out of activation radius" },
      });
      return { ok: false, reason: "vessel is out of gate activation radius" };
    }

    // Directory federation check — OFF/PRIVATE vs trustedPeers (wire, not yatim)
    if (deps.directory) {
      const target = deps.directory.getServer(req.targetRegionId)?.manifest;
      if (target && target.federation === "OFF") return { ok: false, reason: "target federation OFF" };
      if (target && target.federation === "PRIVATE" && target.trustedPeers && !target.trustedPeers.includes(deps.region.regionId)) return { ok: false, reason: "not in trustedPeers" };
    }
    const faction = deps.resolveFaction?.(req.vesselId);
    if (!authorized(link, vessel, faction)) {
      deps.onEvent?.({
        type: "gate.transit.reject",
        gateId: req.gateId,
        regionId: deps.region.regionId,
        targetRegionId: req.targetRegionId,
        vesselId: req.vesselId,
        actorId: req.requestedBy,
        payload: { reason: "community not authorized" },
      });
      return { ok: false, reason: "vessel community not authorized for this gate" };
    }

    // mulai transit.
    deps.onEvent?.({
      type: "gate.transit.start",
      gateId: req.gateId,
      regionId: deps.region.regionId,
      targetRegionId: req.targetRegionId,
      vesselId: req.vesselId,
      actorId: req.requestedBy,
      payload: { position: { ...vessel.position } },
    });

    const handoff = toHandoff(vessel);

    // Crash-safe: persist pending handoff SEBELUM vessel dilepas dari region asal.
    // Kalau crash di tengah (after save, before delete), handoff tersisa di disk dan
    // recovery akan re-deliver vessel ke tujuan — vessel tidak hilang.
    const pending: PendingHandoff = {
      vesselId: handoff.vesselId,
      owner: handoff.owner,
      position: handoff.position,
      hubId: handoff.hubId,
      gateId: req.gateId,
      fromRegionId: deps.region.regionId,
      toRegionId: req.targetRegionId,
      startedAt: new Date().toISOString(),
    };
    if (deps.persist) {
      await deps.persist.savePendingHandoff(pending);
    }

    // lepas vessel dari region lokal (authoritative transfer).
    deps.region.remove(req.vesselId);

    // notify region tujuan (via relay/netcode) untuk men-spawn.
    deps.notifyTarget?.(req.targetRegionId, handoff);

    // deliver sukses → hapus pending handoff (tidak lagi in-flight).
    if (deps.persist) {
      await deps.persist.deletePendingHandoff(req.vesselId, req.gateId);
    }

    deps.onEvent?.({
      type: "gate.transit.complete",
      gateId: req.gateId,
      regionId: deps.region.regionId,
      targetRegionId: req.targetRegionId,
      vesselId: req.vesselId,
      actorId: req.requestedBy,
      payload: { handoff },
    });

    return { ok: true, handoff };
  };

  return {
    transit,
    async recoverPendingHandoffs() {
      if (!deps.persist) return 0;
      const pending = await deps.persist.loadPendingHandoffs();
      let recovered = 0;
      for (const h of pending) {
        deps.notifyTarget?.(h.toRegionId, {
          vesselId: h.vesselId,
          owner: h.owner,
          position: h.position,
          hubId: h.hubId,
        });
        await deps.persist.deletePendingHandoff(h.vesselId, h.gateId);
        recovered++;
      }
      return recovered;
    },
  };
}

// Live — persist crash-safe + relay bridge wired, verified smoke 2-region transit (PR #591/#592).
