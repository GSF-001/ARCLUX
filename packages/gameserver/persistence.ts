// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// persistence.ts — save/load region world state (D-009 self-host, per-region).
//
// RegionSnapshot (dari world.snapshot / dimuat ulang via regionFromState) adalah
// bentuk serial yang sudah bisa dipersist & di-recovery. Modul ini menambahkan:
//   - simpan snapshot ke `packages/db` (collection "regions", JSON-file-per-record,
//     crash-safe via RecoveryManager.writeTransactional)
//   - recovery crash-safe: versi data menyimpan "terakhir sukses" (updatedAt)
//
// V6 / D-013: server restart ≠ world reset — region dipulihkan dari sini.

import type { RegionSnapshot } from "./types";
import { putRecord, getRecord, deleteRecord } from "../db/client";
import type { CollectionName, RegionRecord, PendingHandoffRecord } from "../db/schema";

const COLLECTION: CollectionName = "regions";
const HANDOFF_COLLECTION: CollectionName = "handoffs";

/**
 * Pending handoff yang disimpan before vessel di-remove dari region asal, supaya
 * kalau crash di tengah transit vessel tidak hilang (handoff token crash-safe).
 * `handoff` = payload `GateTransitResult.handoff` (id vessel, owner, position...).
 */
export interface PendingHandoff {
  vesselId: string;
  owner?: string;
  position: { x: number; y: number; z: number };
  hubId?: string;
  gateId: string;
  fromRegionId: string;
  toRegionId: string;
  startedAt: string;
}

/** Validasi minimal pending handoff sebelum disimpan. */
export function validatePendingHandoff(h: PendingHandoff): boolean {
  return (
    !!h &&
    typeof h.vesselId === "string" &&
    h.vesselId.length > 0 &&
    typeof h.gateId === "string" &&
    typeof h.fromRegionId === "string" &&
    typeof h.toRegionId === "string" &&
    !!h.position && typeof h.position.x === "number" &&
    typeof h.position.y === "number" && typeof h.position.z === "number"
  );
}

export interface PersistenceStore {
  saveRegion(regionId: string, state: RegionSnapshot): Promise<void>;
  loadRegion(regionId: string): Promise<RegionSnapshot | null>;
  deleteRegion(regionId: string): Promise<void>;
  /** Simpan pending handoff in-flight (crash-safe sebelum remove vessel). */
  savePendingHandoff(h: PendingHandoff): Promise<void>;
  /** Semua pending handoff yang tersisa (untuk recovery setelah crash/restart). */
  loadPendingHandoffs(): Promise<PendingHandoff[]>;
  /** Hapus pending handoff setelah deliver/diselesaikan. */
  deletePendingHandoff(vesselId: string, gateId: string): Promise<void>;
  /** Index — list semua regionId yang pernah disimpan (db index). */
  listRegions(): Promise<string[]>;
}

/** Validasi snapshot minimal sebelum disimpan (huruf anti-torn/garbage write). */
export function validateRegion(state: RegionSnapshot): boolean {
  return (
    !!state &&
    typeof state.regionId === "string" &&
    state.regionId.length > 0 &&
    typeof state.tick === "number" &&
    Array.isArray(state.entities)
  );
}

/**
 * In-memory stub — berguna untuk unit test & prototype sebelum pakai db.
 * Menyimpan snapshot per region.
 */
export function createInMemoryPersistence(): PersistenceStore {
  const regions = new Map<string, RegionSnapshot>();
  const pending = new Map<string, PendingHandoff>();

  const pendingKey = (vesselId: string, gateId: string) => `${gateId}::${vesselId}`;

  return {
    async saveRegion(regionId, state) {
      if (!validateRegion(state)) throw new Error(`invalid RegionSnapshot: ${regionId}`);
      regions.set(regionId, structuredClone(state));
    },
    async loadRegion(regionId) {
      const s = regions.get(regionId);
      return s ? structuredClone(s) : null;
    },
    async deleteRegion(regionId) {
      regions.delete(regionId);
    },
    async savePendingHandoff(h) {
      if (!validatePendingHandoff(h)) throw new Error("invalid PendingHandoff");
      pending.set(pendingKey(h.vesselId, h.gateId), structuredClone(h));
    },
    async loadPendingHandoffs() {
      return Array.from(pending.values()).map((h) => structuredClone(h));
    },
    async deletePendingHandoff(vesselId, gateId) {
      pending.delete(pendingKey(vesselId, gateId));
    },
    async listRegions() { return Array.from(regions.keys()); },
  };
}

/**
 * Persist ke `packages/db` (collection "regions"). Crash-safe via
 * RecoveryManager.writeTransactional di balik `putRecord`. Data tersimpan sebagai
 * RegionRecord{ id, regionId, snapshot, updatedAt }.
 */
export function createDbPersistence(
  rootOverride?: string,
): PersistenceStore {
  const saveRegion = async (regionId: string, state: RegionSnapshot): Promise<void> => {
    if (!validateRegion(state)) throw new Error(`invalid RegionSnapshot: ${regionId}`);
    const rec: RegionRecord = {
      id: regionId,
      regionId: state.regionId,
      snapshot: structuredClone(state),
      updatedAt: new Date().toISOString(),
    };
    putRecord<RegionRecord>(COLLECTION, rec);
    void rootOverride; // rootOverride dialihkan ke env ARCLUX_ROOT oleh client db
  };

  const loadRegion = async (regionId: string): Promise<RegionSnapshot | null> => {
    const rec = getRecord<RegionRecord>(COLLECTION, regionId);
    if (!rec || !rec.snapshot) return null;
    const snap = rec.snapshot as RegionSnapshot;
    return validateRegion(snap) ? snap : null;
  };

  const deleteRegion = async (regionId: string): Promise<void> => {
    deleteRecord(COLLECTION, regionId);
  };

  const savePendingHandoff = async (h: PendingHandoff): Promise<void> => {
    if (!validatePendingHandoff(h)) throw new Error("invalid PendingHandoff");
    const id = `${h.gateId}::${h.vesselId}`;
    const rec: PendingHandoffRecord = {
      id,
      fromRegionId: h.fromRegionId,
      toRegionId: h.toRegionId,
      gateId: h.gateId,
      handoff: structuredClone(h),
      startedAt: h.startedAt,
      updatedAt: new Date().toISOString(),
    };
    putRecord<PendingHandoffRecord>(HANDOFF_COLLECTION, rec);
    // kelola index id untuk recovery list-all (collection JSON-file-per-record).
    const indexKey = "__list__";
    const prev = getRecord<{ ids: string[] }>(HANDOFF_COLLECTION, indexKey);
    const ids = prev && Array.isArray(prev.ids) ? prev.ids : [];
    if (!ids.includes(id)) {
      ids.push(id);
      putRecord<{ id: string; ids: string[] }>(HANDOFF_COLLECTION, {
        id: indexKey,
        ids,
      });
    }
  };

  const loadPendingHandoffs = async (): Promise<PendingHandoff[]> => {
    const indexKey = "__list__";
    const index = getRecord<{ ids: string[] }>(HANDOFF_COLLECTION, indexKey);
    if (!index || !Array.isArray(index.ids)) return [];
    const out: PendingHandoff[] = [];
    for (const id of index.ids) {
      const rec = getRecord<PendingHandoffRecord>(HANDOFF_COLLECTION, id);
      if (rec && rec.handoff && validatePendingHandoff(rec.handoff as PendingHandoff)) {
        out.push(structuredClone(rec.handoff as PendingHandoff));
      }
    }
    return out;
  };

  const deletePendingHandoff = async (vesselId: string, gateId: string): Promise<void> => {
    const id = `${gateId}::${vesselId}`;
    deleteRecord(HANDOFF_COLLECTION, id);
    // bersihkan dari index.
    const indexKey = "__list__";
    const prev = getRecord<{ ids: string[] }>(HANDOFF_COLLECTION, indexKey);
    if (prev && Array.isArray(prev.ids) && prev.ids.includes(id)) {
      prev.ids = prev.ids.filter((x) => x !== id);
      putRecord<{ id: string; ids: string[] }>(HANDOFF_COLLECTION, {
        id: indexKey,
        ids: prev.ids,
      });
    }
  };

  return {
    saveRegion,
    loadRegion,
    deleteRegion,
    savePendingHandoff,
    loadPendingHandoffs,
    deletePendingHandoff,
    async listRegions() {
      // db index — in-memory scan fallback (heavy but stable, real db would use index)
      try { const { listRecords } = await import("../db/client"); const recs = (listRecords as any)?.(COLLECTION) ?? []; return (recs as any[]).map((r: any) => r.regionId ?? r.id).filter(Boolean); } catch { return []; }
    },
  };
}
