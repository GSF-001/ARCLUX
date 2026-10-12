// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// vesselFixture.ts — fixture vessel untuk test Sprint 7 (lock/projectile/AI).
// Wrapper di atas loadtest::makeVesselModel (satu sumber model test) + override
// integrity (40 = korvette → lock need kecil, test cepat).

import type { VesselEntity } from "../../mmo/packages/gameserver/types";
import { makeVesselModel } from "../../mmo/packages/gameserver/loadtest";

export function makeTestVesselModel(id: string, integrity = 40) {
  const vm = makeVesselModel(id);
  vm.integrity = integrity;
  return vm;
}

/** Set seluruh subsystem health (untuk skenario destroyed). */
export function killVessel(v: VesselEntity): void {
  for (const s of v.vessel.systems) s.health = 0;
}
