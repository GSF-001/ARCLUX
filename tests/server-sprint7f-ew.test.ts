// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Sprint 7 PR-F — ECM/EW jam (09-addendum §11.2 M2).

import { describe, expect, it } from "vitest";
import { WorldRegion } from "../mmo/packages/gameserver/world";
import { SimulationEngine } from "../mmo/packages/gameserver/simulation";
import {
  createLockStore,
  EW_JAM_RANGE_M,
  EW_JAM_COOLDOWN_TICKS,
  LOCK_COOLDOWN_AFTER_JAM,
} from "../mmo/packages/gameserver/targeting";
import type { AuthorityDeps, ValidatorContext } from "../mmo/packages/gameserver/validator";
import { createSessionStore } from "../mmo/packages/gameserver/session";
import { createWantedStore } from "../mmo/packages/wanted";
import { createEconomy } from "../mmo/packages/economy";
import { createHackStore } from "../mmo/packages/gameserver/hack";
import { createClaimStore } from "../mmo/packages/gameserver/claims";
import { makeTestVesselModel as makeVesselModel } from "./helpers/vesselFixture";
import type { PlayerIntent } from "../mmo/packages/gameserver/types";

function makeAuthority(): AuthorityDeps {
  return {
    sessions: createSessionStore(),
    wanted: createWantedStore(),
    economy: createEconomy(),
    hacks: createHackStore(),
    claims: createClaimStore(),
    locks: createLockStore(),
  };
}

const authProvider = (playerId: string): ValidatorContext => ({
  playerId,
  auth: { actor: playerId } as never,
});

interface Fixture {
  region: WorldRegion;
  engine: SimulationEngine;
  authority: AuthorityDeps;
  step(n?: number): void;
  enqueue(intent: PlayerIntent): void;
  events(): ReturnType<SimulationEngine["replayLog"]>;
}

/** atk (p1) → tgt (p2) di z=1000 (dalam range + cone). */
function fixture(targetZ = 1000): Fixture {
  const region = new WorldRegion("t7f-ew", "EW Test");
  const av = makeVesselModel("atk");
  av.integrity = 40;
  region.spawnVessel({ id: "atk", owner: "p1", vessel: av, position: { x: 0, y: 0, z: 0 } });
  const tv = makeVesselModel("tgt");
  tv.integrity = 40;
  region.spawnVessel({ id: "tgt", owner: "p2", vessel: tv, position: { x: 0, y: 0, z: targetZ } });
  const authority = makeAuthority();
  const engine = new SimulationEngine({ region, authProvider, authority });
  return {
    region, engine, authority,
    enqueue: (intent) => engine.enqueue(intent),
    step: (n = 1) => { for (let i = 0; i < n; i++) engine.step(); },
    events: () => engine.replayLog(),
  };
}

const lockIntent = (targetId = "tgt", seq = 1): PlayerIntent => ({
  playerId: "p1", entityId: "atk", type: "lock", payload: { targetId }, seq,
});
const jamIntent = (targetId = "tgt", seq = 10): PlayerIntent => ({
  playerId: "p1", entityId: "atk", type: "ew_jam", payload: { targetId }, seq,
});

describe("Sprint 7 PR-F — ECM/EW jam (09-addendum §11.2 M2)", () => {
  it("1. jam putus semua lock attacker→target + events ew_fired & lock_jammed", () => {
    const f = fixture();
    f.enqueue(lockIntent("tgt"));
    f.step(40);
    expect(f.authority.locks!.lockOn("atk", "tgt")?.phase).toBe("locked");

    f.enqueue(jamIntent());
    f.step(1);
    expect(f.authority.locks!.locksOf("atk")).toHaveLength(0);
    expect(f.events().some((e) => e.type === "ew_fired" && e.payload.locksBroke === 1)).toBe(true);
    expect(f.events().some((e) => e.type === "lock_broken" && e.payload.reason === "jammed")).toBe(true);
  });

  it("2. re-lock dalam window jam → lock_rejected target_jammed; setelah window boleh", () => {
    const f = fixture();
    f.enqueue(lockIntent());
    f.step(40);
    f.enqueue(jamIntent());
    f.step(1);
    // Langsung coba lock lagi — masih dalam LOCK_COOLDOWN_AFTER_JAM.
    f.step(3); // cooldown lock intent (2 tick)
    f.enqueue(lockIntent("tgt", 2));
    f.step(1);
    expect(f.events().some((e) => e.type === "lock_rejected" && e.payload.reason === "target_jammed")).toBe(true);

    // Lewati window jam → lock diterima lagi.
    f.step(LOCK_COOLDOWN_AFTER_JAM + 5);
    f.enqueue(lockIntent("tgt", 3));
    f.step(1);
    expect(f.events().filter((e) => e.type === "lock_started")).toHaveLength(2);
  });

  it("3. subsystem defense mati → ew_system_offline", () => {
    const f = fixture();
    const atk = f.region.getVessel("atk")!;
    const def = atk.vessel.systems.find((sy) => sy.id === "defense")!;
    def.health = 0;
    f.enqueue(jamIntent());
    f.step(1);
    expect(f.events().some((e) => e.type === "intent_rejected" && e.payload.reason === "ew_system_offline")).toBe(true);
    expect(f.region.getVessel("atk")!.cooldowns["ew_jam"] ?? 0).toBe(0);
  });

  it("4. luar range → rejected; cooldown module → second jam rejected", () => {
    // Target di 9000m (> EW_JAM_RANGE_M=6000).
    const f = fixture(9000);
    f.enqueue(jamIntent());
    f.step(1);
    expect(f.events().some((e) => e.type === "intent_rejected" && String(e.payload.reason).includes("out of range"))).toBe(true);

    // Jam valid → cooldown 300 aktif → second jam ditolak.
    const g = fixture();
    g.enqueue(jamIntent());
    g.step(1);
    expect(g.region.getVessel("atk")!.cooldowns["ew_jam"]).toBe(EW_JAM_COOLDOWN_TICKS - 1);
    g.enqueue(jamIntent("tgt", 11));
    g.step(1);
    expect(g.events().some((e) => e.type === "intent_rejected" && String(e.payload.reason).includes("on cooldown"))).toBe(true);
    expect(EW_JAM_RANGE_M).toBe(6000);
  });
});
