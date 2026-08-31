// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// regionState.ts — V6 persistent region state helper (08 §13, D-013).
// regionFromState + resume + D-014 no player pause — hook ke persistence.ts.

import type { RegionSnapshot } from "./types";
import { WorldRegion, regionFromState } from "./world";
import type { PersistenceStore } from "./persistence";

export async function loadAndResume(store: PersistenceStore, regionId: string): Promise<WorldRegion | null> {
  const snap: RegionSnapshot | null = await store.loadRegion(regionId);
  if (!snap) return null;
  const region = regionFromState(snap as any);
  return region;
}

export async function saveSnapshot(store: PersistenceStore, region: WorldRegion): Promise<void> {
  const snap = region.snapshot() as unknown as RegionSnapshot;
  await store.saveRegion(region.regionId, snap);
}

export function isValidResume(snap: RegionSnapshot): boolean {
  return !!snap && typeof snap.regionId === "string" && typeof snap.tick === "number" && Array.isArray(snap.entities);
}
