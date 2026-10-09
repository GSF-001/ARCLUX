// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// regionState.ts — V6 persistent region state helper (08 §13, D-013).
// regionFromState + resume + D-014 no player pause — hook ke persistence.ts.

import { SNAPSHOT_SCHEMA_VERSION, type RegionSnapshot } from "./types";
import { WorldRegion, regionFromState } from "./world";
import type { PersistenceStore } from "./persistence";

export async function loadAndResume(store: PersistenceStore, regionId: string): Promise<WorldRegion | null> {
  const snap: RegionSnapshot | null = await store.loadRegion(regionId);
  if (!snap || !isValidResume(snap)) return null;
  const region = regionFromState(migrateSnapshot(snap));
  return region;
}

export async function saveSnapshot(store: PersistenceStore, region: WorldRegion): Promise<void> {
  const snap = region.snapshot() as unknown as RegionSnapshot;
  await store.saveRegion(region.regionId, snap);
}

/**
 * P2-8: validasi snapshot untuk resume. Snapshot tanpa schemaVersion (lama)
 * di-migrate dulu; snapshot dengan versi LEBIH BARAN dari yang server
 * pahami = tolak (server lama tak boleh restore dunia versi baru).
 */
export function isValidResume(snap: RegionSnapshot): boolean {
  if (!snap || typeof snap.regionId !== "string" || typeof snap.tick !== "number" || !Array.isArray(snap.entities)) {
    return false;
  }
  if (typeof snap.schemaVersion === "number" && snap.schemaVersion > SNAPSHOT_SCHEMA_VERSION) {
    return false;
  }
  return true;
}

/** P2-8: migrate snapshot lama ke skema sekarang (isi field yang hilang). */
export function migrateSnapshot(snap: RegionSnapshot): RegionSnapshot {
  if (snap.schemaVersion === SNAPSHOT_SCHEMA_VERSION) return snap;
  return { ...snap, schemaVersion: SNAPSHOT_SCHEMA_VERSION };
}
