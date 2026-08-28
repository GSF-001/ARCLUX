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
// 🚧 SCAFFOLD — kerangka implementasi. Bagian yang jadi ditandai `// IMPL:`.
//
// RegionSnapshot (dari world.snapshot / dimuat ulang via regionFromState) adalah
// bentuk serial yang sudah bisa dipersist & di-recovery. Modul ini menambahkan:
//   - simpan snapshot ke `packages/db` (RepoStore/AnalysisStore turunan / store
//     baru untuk RegionSnapshot)
//   - recovery crash-safe: config per-sim simpan "terakhir sukses" + anti-torn-write
//
// Relations:
//   - `world.ts` → snapshot()/regionFromState() → persist/load di sini
//   - `packages/db` → penyimpanan real (belum ada store RegionSnapshot → IMPL)
//   - `packages/storage/RecoveryManager` → helper crash-safe (reuse)

import type { RegionSnapshot } from "./types";

export interface PersistenceStore {
  saveRegion(regionId: string, state: RegionSnapshot): Promise<void>;
  loadRegion(regionId: string): Promise<RegionSnapshot | null>;
  deleteRegion(regionId: string): Promise<void>;
}

/**
 * 🚧 In-memory stub — buat ganti dengan `packages/db` store (lihat TODOS).
 * Memungkinkan pipeline persist/load diuji tanpa koneksi DB.
 */
export function createInMemoryPersistence(): PersistenceStore {
  const regions = new Map<string, RegionSnapshot>();

  return {
    async saveRegion(regionId, state) {
      // IMPL: normalize timestamps + validasi before write (lihat TODO(persist)[valid])
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
 * 🚧 Persist ke paket db. Siap memakai store RegionSnapshot yang perlu dibuat
 * dulu di `packages/db` (lihat TODO(persist)[dbstore]).
 */
export function createDbPersistence(
  // IMPL: terima store db (RepoStore-like) — TODO diisi saat store ada
  _db?: unknown,
): PersistenceStore {
  return {
    async saveRegion() {
      throw new Error("db persistence not implemented yet (scaffold)");
    },
    async loadRegion() {
      return null;
    },
    async deleteRegion() {
      // no-op: belum ada store
    },
  };
}

//
// §TODOS — tinggal isi satu per satu, update check saat selesai
//
// TODO(persist)[dbstore]   buat RegionStore di packages/db (schema RegionState v1)
// TODO(persist)[dbbe]      implementasikan createDbPersistence di atas store tsb
// TODO(persist)[valid]     validateRegion(state) sebelum save (pakai universe/schema pattern)
// TODO(persist)[crash]     RecoveryManager: simpan pointer "last-good" + versioned snapshot
// TODO(persist)[recovery]  regionFromState() dipakai overload setelah load (sudah ada di world)
// TODO(persist)[test]      smoke: create region → snapshot → save → load → regionFromState == equal
