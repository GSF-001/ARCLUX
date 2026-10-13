// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Sprint 7 PR-E — multi-lock 3 slot + rocket wiring (09-addendum §11.2 M1/M6).

import { describe, expect, it } from "vitest";
import { WorldRegion } from "../mmo/packages/gameserver/world";
import { SimulationEngine } from "../mmo/packages/gameserver/simulation";
import { createLockStore, LOCK_MAX_SLOTS } from "../mmo/packages/gameserver/targeting";
import type { AuthorityDeps } from "../mmo/packages/gameserver/validator";
import type { ValidatorContext } from "../mmo/packages/gameserver/validator";
import { createSessionStore } from "../mmo/packages/gameserver/session";
import { createInMemoryPersistence } from "../mmo/packages/gameserver/persistence";
import { createWantedStore } from "../mmo/packages/wanted";
import { createEconomy } from "../mmo/packages/economy";
import { createHackStore } from "../mmo/packages/gameserver/hack";
import { createClaimStore } from "../mmo/packages/gameserver/claims";
import { makeTestVesselModel as makeVesselModel } from "./helpers/vesselFixture";
import { WEAPON_DEFS } from "../mmo/packages/gameserver/projectiles";
import type { PlayerIntent, VesselEntity } from "../mmo/packages/gameserver/types";

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

function spawnTgt(region: WorldRegion, id: string, owner: string, z: number): VesselEntity {
  const tv = makeVesselModel(id);
  tv.integrity = 40;
  return region.spawnVessel({ id, owner, vessel: tv, position: { x: 0, y: 0, z } });
}

/** Dunia: atk (p1) + 4 target depan lurus (z 1000..1600) — semua in-cone. */
function fixture(): Fixture {
  const region = new WorldRegion("t7e-multilock", "MultiLock Test");
  const av = makeVesselModel("atk");
  av.integrity = 40;
  region.spawnVessel({ id: "atk", owner: "p1", vessel: av, position: { x: 0, y: 0, z: 0 } });
  spawnTgt(region, "tgt1", "p2", 1000);
  spawnTgt(region, "tgt2", "p3", 1200);
  spawnTgt(region, "tgt3", "p4", 1400);
  spawnTgt(region, "tgt4", "p5", 1600);
  const authority = makeAuthority();
  const engine = new SimulationEngine({ region, authProvider, authority });
  return {
    region, engine, authority,
    enqueue: (intent) => engine.enqueue(intent),
    step: (n = 1) => { for (let i = 0; i < n; i++) engine.step(); },
    events: () => engine.replayLog(),
  };
}

const lockIntent = (targetId: string, seq = 1): PlayerIntent => ({
  playerId: "p1", entityId: "atk", type: "lock", payload: { targetId }, seq,
});

describe("Sprint 7 PR-E — multi-lock (09-addendum §11.2 M1/M6)", () => {
  it("1. 3 lock berbeda → semua slot acquired", () => {
    const f = fixture();
    // Rate-limit lock intent = 1/2 tick — jarak antar intent (§2.3).
    f.enqueue(lockIntent("tgt1"));
    f.step(3);
    f.enqueue(lockIntent("tgt2", 2));
    f.step(3);
    f.enqueue(lockIntent("tgt3", 3));
    f.step(40);
    const locks = f.authority.locks!.locksOf("atk");
    expect(locks).toHaveLength(3);
    expect(locks.every((l) => l.phase === "locked")).toBe(true);
    expect(f.events().filter((e) => e.type === "lock_acquired")).toHaveLength(3);
  });

  it("2. lock ke-4 → rejected lock_slots_full", () => {
    const f = fixture();
    f.enqueue(lockIntent("tgt1"));
    f.step(3);
    f.enqueue(lockIntent("tgt2", 2));
    f.step(3);
    f.enqueue(lockIntent("tgt3", 3));
    f.step(3); // slot sudah keisi 3 (acquiring)
    f.enqueue(lockIntent("tgt4", 4));
    f.step(1);
    expect(f.events().some((e) => e.type === "lock_rejected" && e.payload.reason === "lock_slots_full")).toBe(true);
    expect(f.authority.locks!.locksOf("atk")).toHaveLength(LOCK_MAX_SLOTS);
  });

  it("3. missile wajib lock pada target yang sama — slot mana pun valid", () => {
    const f = fixture();
    f.enqueue(lockIntent("tgt2"));
    f.step(40);
    expect(f.authority.locks!.lockOn("atk", "tgt2")?.phase).toBe("locked");
    f.enqueue({ playerId: "p1", entityId: "atk", type: "attack", payload: { targetId: "tgt1", weapon: "weapon.missile" }, seq: 10 });
    f.step(1);
    expect(f.events().some((e) => e.type === "intent_rejected" && e.payload.reason === "lock_required")).toBe(true);
    f.enqueue({ playerId: "p1", entityId: "atk", type: "attack", payload: { targetId: "tgt2", weapon: "weapon.missile" }, seq: 11 });
    f.step(1);
    expect(f.events().some((e) => e.type === "projectile_spawned")).toBe(true);
  });

  it("4. unlock {targetId} → hanya slot itu hilang, slot lain utuh", () => {
    const f = fixture();
    f.enqueue(lockIntent("tgt1"));
    f.step(3);
    f.enqueue(lockIntent("tgt2", 2));
    f.step(10);
    f.enqueue({ playerId: "p1", entityId: "atk", type: "unlock", payload: { targetId: "tgt1" }, seq: 3 });
    f.step(1);
    expect(f.authority.locks!.locksOf("atk").map((l) => l.targetId)).toEqual(["tgt2"]);
    expect(f.events().filter((e) => e.type === "lock_broken" && e.payload.reason === "manual")).toHaveLength(1);
  });

  it("5. unlock {} → semua slot dilepas", () => {
    const f = fixture();
    f.enqueue(lockIntent("tgt1"));
    f.step(3);
    f.enqueue(lockIntent("tgt2", 2));
    f.step(3);
    f.enqueue(lockIntent("tgt3", 3));
    f.step(5);
    f.enqueue({ playerId: "p1", entityId: "atk", type: "unlock", payload: {}, seq: 4 });
    f.step(1);
    expect(f.authority.locks!.locksOf("atk")).toHaveLength(0);
    expect(f.events().filter((e) => e.type === "lock_broken" && e.payload.reason === "manual")).toHaveLength(3);
  });

  it("6. target di slot mati → break hanya slot itu", () => {
    const f = fixture();
    f.enqueue(lockIntent("tgt1"));
    f.step(3);
    f.enqueue(lockIntent("tgt2", 2));
    f.step(10);
    for (const s of f.region.getVessel("tgt1")!.vessel.systems) s.health = 0;
    f.step(2);
    expect(f.events().filter((e) => e.type === "lock_broken" && e.payload.targetId === "tgt1" && e.payload.reason === "target_destroyed")).toHaveLength(1);
    expect(f.authority.locks!.locksOf("atk").map((l) => l.targetId)).toEqual(["tgt2"]);
  });

  it("7. rocket: WEAPON_DEFS aktif — spawn projectile dari intent (M6)", () => {
    const f = fixture();
    expect(WEAPON_DEFS["weapon.rocket"]).toBeDefined();
    f.enqueue(lockIntent("tgt1"));
    f.step(40);
    f.enqueue({ playerId: "p1", entityId: "atk", type: "attack", payload: { targetId: "tgt1", weapon: "weapon.rocket" }, seq: 20 });
    f.step(1);
    expect(f.events().some((e) => e.type === "projectile_spawned" && e.payload.weaponType === "weapon.rocket")).toBe(true);
    expect(f.region.projectiles).toHaveLength(1);
  });
});
