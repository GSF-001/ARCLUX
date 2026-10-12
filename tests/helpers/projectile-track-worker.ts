// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// projectile-track-worker.ts — anak proses determinisme Sprint 7 PR-B (§3.6 #7).
// Lock → fire missile → 30 tick → cetak seri {tick, n, head(pos+ttl)} per tick.
// Dijalankan 2× oleh tests/server-sprint7-projectile.test.ts — wajib identik.

import { WorldRegion } from "../../mmo/packages/gameserver/world";
import { SimulationEngine } from "../../mmo/packages/gameserver/simulation";
import { createLockStore, lockNeedFor } from "../../mmo/packages/gameserver/targeting";
import { createSessionStore } from "../../mmo/packages/gameserver/session";
import { createWantedStore } from "../../mmo/packages/wanted";
import { createEconomy } from "../../mmo/packages/economy";
import { createHackStore } from "../../mmo/packages/gameserver/hack";
import { createClaimStore } from "../../mmo/packages/gameserver/claims";
import { makeTestVesselModel } from "./vesselFixture";
import type { ValidatorContext } from "../../mmo/packages/gameserver/validator";
import type { PlayerIntent } from "../../mmo/packages/gameserver/types";

const region = new WorldRegion("t7-prj-worker", "Prj Worker");
const av = makeTestVesselModel("atk");
av.integrity = 40;
region.spawnVessel({ id: "atk", owner: "p1", vessel: av, position: { x: 0, y: 0, z: 0 } });
const tv = makeTestVesselModel("tgt");
tv.integrity = 40;
region.spawnVessel({ id: "tgt", owner: "p2", vessel: tv, position: { x: 0, y: 0, z: 800 } });

const authority = {
  sessions: createSessionStore(),
  wanted: createWantedStore(),
  economy: createEconomy(),
  hacks: createHackStore(),
  claims: createClaimStore(),
  locks: createLockStore(),
};
const authProvider = (playerId: string): ValidatorContext => ({
  playerId,
  auth: { actor: playerId } as never,
});
const engine = new SimulationEngine({ region, authProvider, authority });

const need = lockNeedFor(region.get("tgt")!);
engine.enqueue({ playerId: "p1", entityId: "atk", type: "lock", payload: { targetId: "tgt" }, seq: 0 } as PlayerIntent);
for (let i = 0; i < need + 2; i++) engine.step();
if (authority.locks?.current("atk")?.phase !== "locked") {
  throw new Error("lock never reached");
}
engine.enqueue({
  playerId: "p1", entityId: "atk", type: "attack",
  payload: { targetId: "tgt", weapon: "weapon.missile" }, seq: 1,
} as PlayerIntent);

const series: Array<{ tick: number; n: number; head: string }> = [];
for (let i = 0; i < 30; i++) {
  engine.step();
  const p = region.projectiles[0];
  series.push({
    tick: region.tick,
    n: region.projectiles.length,
    head: p ? `${p.pos.x},${p.pos.y},${p.pos.z}|${p.ttlTicks}|${p.armTicks}` : "gone",
  });
}
console.log(JSON.stringify(series));
