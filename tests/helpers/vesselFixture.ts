// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// vesselFixture.ts — fixture vessel untuk test Sprint 7 (lock/projectile/AI).
// Duplikat sadar dari `makeVesselModel` loadtest (branch Sprint 6 — belum
// merge ke main); kalau keduanya sudah ada di main, refactor jadi satu.

import type { VesselEntity } from "../../mmo/packages/gameserver/types";
import type { VesselModel } from "../../mmo/packages/universe/types";

export function makeTestVesselModel(id: string, integrity = 40): VesselModel {
  const subs = ["engine", "reactor", "navigation", "defense", "weapons", "ai"];
  return {
    id,
    name: `Test ${id}`,
    source: { org: "test", repo: id, defaultBranch: "main", analyzedAt: "2026-01-01T00:00:00Z" },
    license: "open",
    systems: subs.map((s) => ({ id: s, label: s, health: 70, baseStat: 70 })),
    components: [],
    integrity,
    defense: 75,
    weapons: 65,
    engine: 70,
  } as unknown as VesselModel;
}

/** Set seluruh subsystem health (untuk skenario destroyed). */
export function killVessel(v: VesselEntity): void {
  for (const s of v.vessel.systems) s.health = 0;
}
