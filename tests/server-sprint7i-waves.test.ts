// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Sprint 7 PR-I — wave table data-driven + continuous (09-addendum §11.2 M5).

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
import {
  createNpcStore, createWaveStore,
  requestWaveFromTable, waveTableEntry, WAVE_TABLE, stepWaves,
} from "../mmo/packages/gameserver/npcBrain";
import { makeTestVesselModel } from "./helpers/vesselFixture";
import type { PlayerIntent, VesselEntity } from "../mmo/packages/gameserver/types";

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

function fixture(): Fixture {
  const region = new WorldRegion("t7i-waves", "Wave Table Test");
  const pv = makeTestVesselModel("p1v", 100);
  region.spawnVessel({ id: "p1v", owner: "p1", vessel: pv, position: { x: 0, y: 0, z: 0 } });
  const authority = makeAuthority();
  const engine = new SimulationEngine({ region, authProvider, authority });
  return {
    region, engine, authority,
    enqueue: (intent) => engine.enqueue(intent),
    step: (n = 1) => { for (let i = 0; i < n; i++) engine.step(); },
    events: () => engine.replayLog(),
  };
}

/** Kill semua NPC wave (hull 0) → completed. Brain dummy (tanpa vessel) dilewati. */
function killAllNpc(f: Fixture): void {
  for (const b of f.authority.npcs.all()) {
    const v = f.region.get(b.vesselId);
    if (!v || v.kind !== "vessel") continue;
    for (const sys of v.vessel.systems) sys.health = 0;
  }
  f.step(2);
}

describe("Sprint 7 PR-I — wave table data-driven (09-addendum §11.2 M5)", () => {
  it("1. waveTableEntry: wave 1 = {3,pirate}, wave 3 = {7,raider}; loop di ujung", () => {
    expect(WAVE_TABLE.length).toBeGreaterThanOrEqual(3);
    expect(waveTableEntry(1)).toEqual({ count: 3, faction: "pirate" });
    expect(waveTableEntry(3).faction).toBe("raider");
    expect(waveTableEntry(WAVE_TABLE.length + 1)).toEqual(WAVE_TABLE[0]); // loop
  });

  it("2. requestWaveFromTable: wave#1 count=3 faction=pirate; wave#2 count=5", () => {
    const f = fixture();
    const origin = { x: 0, y: 0, z: 0 };
    const r1 = requestWaveFromTable(f.region, f.authority.npcs, f.authority.waves, { seed: 7, origin }, f.region.tick);
    expect(r1.ok).toBe(true);
    f.step(3 + 1 + 3 + 2);
    expect(f.authority.waves.state.wave).toBe(1);
    expect(f.authority.waves.state.total).toBe(3);
    expect(f.authority.waves.state.spawned).toBe(3);
    expect(f.events().find((e) => e.type === "wave_started")?.payload.count).toBe(3);
    // Faction: NPC entry memakai faction dari table (pirate).
    expect(f.authority.npcs.all().every((b) => b.vesselId.includes("npc-w1"))).toBe(true);

    killAllNpc(f);
    expect(f.authority.waves.state.phase).toBe("completed");

    // Wave#2 dari table → count=5.
    const r2 = requestWaveFromTable(f.region, f.authority.npcs, f.authority.waves, { origin }, f.region.tick);
    expect(r2.ok).toBe(true);
    expect(f.authority.waves.state.wave).toBe(2);
    expect(f.authority.waves.state.total).toBe(5);
    // Seed deterministik: lastSeed+1.
    expect(f.authority.waves.state.lastSeed).toBe(8);
  });

  it("3. wave_continuous: completed → auto-next (wave_queued source=continuous)", () => {
    const f = fixture();
    const origin = { x: 0, y: 0, z: 0 };
    f.authority.waves.state.continuous = true;
    requestWaveFromTable(f.region, f.authority.npcs, f.authority.waves, { seed: 10, origin }, f.region.tick);
    f.step(3 + 1 + 3 + 2);
    killAllNpc(f);
    // Auto-next: wave 2 (count 5) langsung spawning/wait.
    expect(f.authority.waves.state.wave).toBe(2);
    expect(f.authority.waves.state.total).toBe(5);
    expect(f.events().some((e) => e.type === "wave_queued" && e.payload.source === "continuous")).toBe(true);
    expect(f.authority.waves.state.phase).not.toBe("completed"); // lanjut
  });

  it("4. continuous + budget reject → wave_continuous_off", () => {
    // Unit test stepWaves langsung (pola test AI #5) — tanpa engine step
    // (brain cleanup vessel-hilang di stepNpcAi tak menghapus dummy store).
    const f = fixture();
    const origin = { x: 0, y: 0, z: 0 };
    f.authority.waves.state.continuous = true;
    requestWaveFromTable(f.region, f.authority.npcs, f.authority.waves, { seed: 1, origin }, f.region.tick);
    f.step(3 + 1 + 3 + 2); // wave#1 in_progress (3 NPC aktif)
    expect(f.authority.waves.state.phase).toBe("in_progress");

    // Penuhkan budget: 17 dummy brain + 3 NPC asli = 20 (MAX).
    for (let i = 0; i < 17; i++) {
      f.authority.npcs.add({ vesselId: `dummy-${i}`, faction: "pirate", state: "patrol" } as never);
    }
    // Kill NPC asli (hull 0) — alive=0 → completed; stepWaves LANGSUNG
    // (bukan engine.step — hindari brain cleanup dummy).
    for (const b of f.authority.npcs.all()) {
      const v = f.region.get(b.vesselId);
      if (!v || v.kind !== "vessel") continue;
      for (const sys of v.vessel.systems) sys.health = 0;
    }
    const logs: Array<{ type: string; meta: Record<string, unknown> }> = [];
    stepWaves(f.region, f.authority.npcs, f.authority.waves, f.region.tick + 1, (type, meta) => logs.push({ type, meta }));
    expect(f.authority.waves.state.phase).toBe("completed");
    expect(f.authority.waves.state.continuous).toBe(false);
    expect(logs.some((l) => l.type === "wave_continuous_off" && l.meta.reason === "ai_budget")).toBe(true);
  });
});
