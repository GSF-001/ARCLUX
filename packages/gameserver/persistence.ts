// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
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
import type { CollectionName, RegionRecord } from "../db/schema";

const COLLECTION: CollectionName = "regions";

export interface PersistenceStore {
  saveRegion(regionId: string, state: RegionSnapshot): Promise<void>;
  loadRegion(regionId: string): Promise<RegionSnapshot | null>;
  deleteRegion(regionId: string): Promise<void>;
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

  return { saveRegion, loadRegion, deleteRegion };
}
