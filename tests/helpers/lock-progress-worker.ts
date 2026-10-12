// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// lock-progress-worker.ts — anak proses determinisme Sprint 7 PR-A (§2.6 #9).
// Bangun dunia fixture (seeded, tanpa input eksternal) → jalankan lock cycle
// N tick → cetak seri {tick, progress, phase} sebagai JSON. Dijalankan 2× oleh
// tests/server-sprint7-lock.test.ts — output wajib identik.

import { WorldRegion } from "../../mmo/packages/gameserver/world";
import { SimulationEngine } from "../../mmo/packages/gameserver/simulation";
import { createLockStore, lockNeedFor } from "../../mmo/packages/gameserver/targeting";
import { createSessionStore } from "../../mmo/packages/gameserver/session";
import { createWantedStore } from "../../mmo/packages/wanted";
import { createEconomy } from "../../mmo/packages/economy";
import { createHackStore } from "../../mmo/packages/gameserver/hack";
import { createClaimStore } from "../../mmo/packages/gameserver/claims";
import { makeTestVesselModel as makeVesselModel } from "./vesselFixture";
import type { ValidatorContext } from "../../mmo/packages/gameserver/validator";
import type { PlayerIntent } from "../../mmo/packages/gameserver/types";

const region = new WorldRegion("t7-worker", "Lock Worker");
const av = makeVesselModel("atk");
av.integrity = 40;
region.spawnVessel({ id: "atk", owner: "p1", vessel: av, position: { x: 0, y: 0, z: 0 } });
const tv = makeVesselModel("tgt");
tv.integrity = 40;
region.spawnVessel({ id: "tgt", owner: "p2", vessel: tv, position: { x: 0, y: 0, z: 1200 } });

const locks = createLockStore();
const authority = {
  sessions: createSessionStore(),
  wanted: createWantedStore(),
  economy: createEconomy(),
  hacks: createHackStore(),
  claims: createClaimStore(),
  locks,
};
const authProvider = (playerId: string): ValidatorContext => ({
  playerId,
  auth: { actor: playerId } as never,
});
const engine = new SimulationEngine({ region, authProvider, authority });

const need = lockNeedFor(region.get("tgt")!);
const lock: PlayerIntent = {
  playerId: "p1", entityId: "atk", type: "lock", payload: { targetId: "tgt" }, seq: 0,
};
engine.enqueue(lock);

const series: Array<{ tick: number; progress: number; phase: string }> = [];
for (let i = 0; i < need + 5; i++) {
  engine.step();
  const cur = locks.current("atk");
  series.push({
    tick: region.tick,
    progress: cur?.progress ?? -1,
    phase: cur?.phase ?? "none",
  });
}
console.log(JSON.stringify(series));
