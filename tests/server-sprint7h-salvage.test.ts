// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Sprint 7 PR-H — wreck salvage (09-addendum §11.2 M4).

import { describe, expect, it } from "vitest";
import { WorldRegion } from "../mmo/packages/gameserver/world";
import { SimulationEngine } from "../mmo/packages/gameserver/simulation";
import { createLockStore } from "../mmo/packages/gameserver/targeting";
import type { AuthorityDeps, ValidatorContext } from "../mmo/packages/gameserver/validator";
import { createSessionStore } from "../mmo/packages/gameserver/session";
import { createWantedStore } from "../mmo/packages/wanted";
import { createEconomy } from "../mmo/packages/economy";
import { createHackStore } from "../mmo/packages/gameserver/hack";
import { createClaimStore } from "../mmo/packages/gameserver/claims";
import { createNpcStore, createWaveStore } from "../mmo/packages/gameserver/npcBrain";
import { makeTestVesselModel } from "./helpers/vesselFixture";
import { makeVesselModel as loadtestVesselModel } from "../mmo/packages/gameserver/loadtest";
import { WRECK_TTL_TICKS, SALVAGE_RANGE_M } from "../mmo/packages/gameserver/npcBrain";
import type { PlayerIntent } from "../mmo/packages/gameserver/types";

function makeAuthority(): AuthorityDeps {
  return {
    sessions: createSessionStore(),
    wanted: createWantedStore(),
    economy: createEconomy(),
    hacks: createHackStore(),
    claims: createClaimStore(),
    locks: createLockStore(),
    npcs: createNpcStore(),
    waves: createWaveStore(),
  };
}

const authProvider = (playerId: string): ValidatorContext => ({
  playerId,
  auth: { actor: playerId } as never,
});

interface Fixture {
  region: WorldRegion;
  engine: SimulationEngine;
  authority: ReturnType<typeof makeAuthority>;
  step(n?: number): void;
  enqueue(intent: PlayerIntent): void;
  events(): ReturnType<SimulationEngine["replayLog"]>;
}

/** player (p1) + NPC pirate diam di z=400 (dalam salvage range). */
function fixture(playerZ = 400): Fixture {
  const region = new WorldRegion("t7h-salvage", "Salvage Test");
  const pv = makeTestVesselModel("p1v", 100);
  region.spawnVessel({ id: "p1v", owner: "p1", vessel: pv, position: { x: 0, y: 0, z: playerZ } });
  const authority = makeAuthority();
  const engine = new SimulationEngine({ region, authProvider, authority });
  return {
    region, engine, authority,
    enqueue: (intent) => engine.enqueue(intent),
    step: (n = 1) => { for (let i = 0; i < n; i++) engine.step(); },
    events: () => engine.replayLog(),
  };
}

/** NPC diam → kill instan (hull 0) → wreck. */
function spawnNpcAndKill(f: Fixture, id = "npc-target"): void {
  const npc = f.region.spawnVessel({
    id, owner: "npc:pirate:test", vessel: loadtestVesselModel(id),
    position: { x: 0, y: 0, z: 400 },
  });
  for (const sys of npc.vessel.systems) sys.health = 0;
  f.enqueue({ playerId: "p1", entityId: "p1v", type: "attack", payload: { targetId: id, weapon: "weapon.plasma" }, seq: 1 });
  f.step(1);
}

const salvageIntent = (seq = 2, wreckId = "wreck:npc-target"): PlayerIntent => ({
  playerId: "p1", entityId: "p1v", type: "salvage", payload: { wreckId }, seq,
});

describe("Sprint 7 PR-H — wreck salvage (09-addendum §11.2 M4)", () => {
  it("1. kill NPC → wreck_spawned (bukan loot instan)", () => {
    const f = fixture();
    const bal0 = f.authority.economy.balanceOf("p1");
    spawnNpcAndKill(f);
    const wreck = f.region.getWreck("wreck:npc-target");
    expect(wreck).toBeTruthy();
    expect(wreck!.contentsCredits).toBeGreaterThanOrEqual(1);
    expect(f.events().some((e) => e.type === "wreck_spawned")).toBe(true);
    expect(f.authority.economy.balanceOf("p1")).toBe(bal0); // tanpa instan
  });

  it("2. salvage dalam range → salvage_completed + economy naik + wreck hilang", () => {
    const f = fixture();
    spawnNpcAndKill(f);
    const bal0 = f.authority.economy.balanceOf("p1");
    const contents = f.region.getWreck("wreck:npc-target")!.contentsCredits;
    f.enqueue(salvageIntent());
    f.step(1);
    expect(f.events().some((e) => e.type === "salvage_completed" && e.payload.credits === contents)).toBe(true);
    expect(f.authority.economy.balanceOf("p1")).toBe(bal0 + contents);
    expect(f.region.getWreck("wreck:npc-target")).toBeUndefined();
  });

  it("3. salvage di luar range → intent_rejected", () => {
    const f = fixture(3000); // player jauh dari NPC z=400 (>500m)
    spawnNpcAndKill(f);
    f.enqueue(salvageIntent());
    f.step(1);
    expect(f.events().some((e) => e.type === "intent_rejected" && String(e.payload.reason).includes("salvage range"))).toBe(true);
    expect(f.region.getWreck("wreck:npc-target")).toBeTruthy(); // tetap ada
    expect(SALVAGE_RANGE_M).toBe(500);
  });

  it("4. wreck expire setelah WRECK_TTL_TICKS → hilang", () => {
    const f = fixture();
    spawnNpcAndKill(f);
    f.step(WRECK_TTL_TICKS + 1);
    expect(f.region.getWreck("wreck:npc-target")).toBeUndefined();
    // Salvage setelah expire → rejected.
    f.enqueue(salvageIntent());
    f.step(1);
    expect(f.events().some((e) => e.type === "intent_rejected" && String(e.payload.reason).includes("unknown wreck"))).toBe(true);
  });

  it("5. wave in_progress: salvage menaikkan waves.state.salvage", () => {
    const f = fixture();
    const waves = f.authority.waves!;
    waves.state.phase = "in_progress";
    waves.state.salvage = 0;
    spawnNpcAndKill(f);
    f.enqueue(salvageIntent());
    f.step(1);
    expect(waves.state.salvage).toBeGreaterThan(0); // cumulative (11.2 M4)
  });
});
