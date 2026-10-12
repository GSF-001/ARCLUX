// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// server-sprint7-ai.test.ts — Sprint 7 PR-C (09-combat-depth §4.4):
// NPC AI combat + wave spawner — 6 regresi wajib.

import { describe, it, expect } from "vitest";

import { WorldRegion } from "../mmo/packages/gameserver/world";
import { SimulationEngine } from "../mmo/packages/gameserver/simulation";
import {
  createNpcStore,
  createWaveStore,
  spawnNpc,
  requestWave,
  stepWaves,
  isHostile,
  NPC_MAX_ACTIVE_PER_REGION,
  NPC_THINK_PERIOD_TICKS,
  npcVesselModel,
  salvageCreditsFor,
} from "../mmo/packages/gameserver/npcBrain";
import { createLockStore } from "../mmo/packages/gameserver/targeting";
import { createSessionStore } from "../mmo/packages/gameserver/session";
import { createWantedStore } from "../mmo/packages/wanted";
import { createEconomy } from "../mmo/packages/economy";
import { createHackStore } from "../mmo/packages/gameserver/hack";
import { createClaimStore } from "../mmo/packages/gameserver/claims";
import { DAMAGE_CEILING } from "../mmo/packages/gameserver/combat";
import { makeTestVesselModel } from "./helpers/vesselFixture";
import type { PlayerIntent, VesselEntity } from "../mmo/packages/gameserver/types";
import type { ValidatorContext } from "../mmo/packages/gameserver/validator";

function makeAuthority() {
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
  player: VesselEntity;
  enqueue(intent: PlayerIntent): void;
  step(n?: number): void;
  events(): ReturnType<SimulationEngine["replayLog"]>;
}

/** Dunia: NPC pirate patrol di origin, player vessel di +Z 3000m. */
function fixture(opts?: { playerZ?: number; playerIntegrity?: number }): Fixture {
  const region = new WorldRegion("t7-ai", "AI Test");
  const pv = makeTestVesselModel("p1v", opts?.playerIntegrity ?? 100);
  const player = region.spawnVessel({
    id: "p1v", owner: "p1", vessel: pv,
    position: { x: 0, y: 0, z: opts?.playerZ ?? 3000 },
  });
  const authority = makeAuthority();
  const engine = new SimulationEngine({ region, authProvider, authority });
  return {
    region, engine, authority, player,
    enqueue: (intent) => engine.enqueue(intent),
    step: (n = 1) => { for (let i = 0; i < n; i++) engine.step(); },
    events: () => engine.replayLog(),
  };
}

function spawnPirate(f: Fixture, id = "npc-1", pos = { x: 0, y: 0, z: 0 }): VesselEntity {
  return spawnNpc(f.region, f.authority.npcs, {
    id, faction: "pirate", position: pos, patrolPoint: pos,
  });
}

function attack(targetId: string, seq: number, entityId = "p1v"): PlayerIntent {
  return {
    playerId: "p1", entityId, type: "attack",
    payload: { targetId, weapon: "weapon.plasma" }, seq,
  };
}

describe("Sprint 7 PR-C NPC AI (09 §4.4)", () => {
  it("1. hostile masuk sensor → DETECT→CHASE→FIRE deterministik, damage ≤ ceiling", () => {
    const f = fixture();
    spawnPirate(f);
    // weapon.plasma → subsystem "weapons" (resolveTargetSubsystem).
    const weaponHealth = () => f.player.vessel.systems.find((s) => s.id === "weapons")!.health;
    const before = weaponHealth();
    f.step(45);
    const combat = f.events().filter((e) => e.type === "npc_combat");
    expect(combat.length).toBeGreaterThanOrEqual(1);
    expect(combat[0].payload.damage).toBeLessThanOrEqual(DAMAGE_CEILING);
    expect(weaponHealth()).toBeLessThan(before);
    // State machine benar-benar berjalan (bukan stuck patrol).
    const brain = f.authority.npcs.get("npc-1");
    expect(["chase", "fire", "aim", "detect"]).toContain(brain?.state);
  });

  it("2. target masuk safe-zone → AI RETURN, tidak ada hit setelahnya", () => {
    const f = fixture();
    spawnPirate(f);
    f.step(20); // AI sudah DETECT/CHASE (menembak sekali-dua kali)
    const weaponHealth = () => f.player.vessel.systems.find((s) => s.id === "weapons")!.health;
    const hitsBefore = f.events().filter((e) => e.type === "npc_combat").length;
    // Station safe-zone muncul di posisi player.
    f.region.spawnStation({ id: "st-safe", name: "Safe", owner: "gov", position: { x: 0, y: 0, z: 3000 }, safeZoneRadius: 1200 });
    // AI sadari zone (max beberapa think) → TIDAK PERNAH chase/aim/fire lagi.
    for (let i = 0; i < 40; i++) {
      f.step(1);
      if (i < NPC_THINK_PERIOD_TICKS + 1) continue; // grace: think pasca-zone belum jalan
      const st = f.authority.npcs.get("npc-1")?.state;
      expect(["patrol", "return", "detect"]).toContain(st); // tak pernah mengejar
    }
    expect(f.events().filter((e) => e.type === "npc_combat").length).toBe(hitsBefore);
    const hp = weaponHealth();
    f.step(20);
    expect(weaponHealth()).toBe(hp); // nol hit setelah zone
  });

  it("3. kill NPC → npc_killed + salvage credits, wanted pemain TIDAK naik", () => {
    const f = fixture();
    // NPC vessel tanpa brain (diam) — fokus kill handler (pola sprint2:
    // hull 0 = semua subsystem habis; kill path natural mustahil karena
    // navigation/ai tak bisa didamage — baseline hullOf avg).
    const npc = f.region.spawnVessel({
      id: "npc-target", owner: "npc:pirate:test", vessel: npcVesselModel("pirate", 1),
      position: { x: 0, y: 0, z: 1000 },
    });
    const bal0 = f.authority.economy.balanceOf("p1");
    for (const sys of npc.vessel.systems) sys.health = 0; // hull 0 = hancur
    f.enqueue(attack("npc-target", 1));
    f.step(1);
    expect(f.region.get("npc-target")).toBeUndefined(); // di-remove setelah kill
    const killed = f.events().find((e) => e.type === "npc_killed");
    expect(killed).toBeTruthy();
    expect(f.authority.wanted.levelOf("p1")).toBe(0); // tanpa wanted (05 §2)
    expect(f.authority.economy.balanceOf("p1")).toBeGreaterThan(bal0); // salvage
    expect(salvageCreditsFor("npc-target")).toBeGreaterThanOrEqual(50);
    void npc;
  });

  it("4. wave N=5 → counter 5; kill semua → wave_completed; seed sama = spawn identik", () => {
    const f = fixture();
    const res = requestWave(f.region, f.authority.npcs, f.authority.waves, {
      seed: 42, count: 5, origin: { x: 0, y: 0, z: 0 },
    }, f.region.tick);
    expect(res.ok).toBe(true);
    f.step(3 + 1 + 5 + 2); // pre-roll + spawn stagger + in_progress confirm
    expect(f.authority.waves.state.spawned).toBe(5);
    expect(f.authority.waves.state.phase).toBe("in_progress");
    expect(f.events().find((e) => e.type === "wave_started")?.payload.count).toBe(5);
    // Kill semua NPC (hull 0) → wave_completed.
    for (const b of f.authority.npcs.all()) {
      const v = f.region.get(b.vesselId) as VesselEntity;
      for (const s of v.vessel.systems) s.health = 0;
    }
    f.step(2);
    expect(f.authority.waves.state.phase).toBe("completed");
    expect(f.events().find((e) => e.type === "wave_completed")).toBeTruthy();

    // Seed sama → pending spawn identik (determinisme wave).
    const f2 = fixture();
    requestWave(f2.region, f2.authority.npcs, f2.authority.waves, {
      seed: 42, count: 5, origin: { x: 0, y: 0, z: 0 },
    }, 0);
    expect(f2.authority.waves.state.pending).toEqual(f.authority.waves.state.pending.map((p) => ({ ...p })));
  });

  it("5. budget: request 25 → reject ai_budget; request 20 → 20 aktif", () => {
    const f = fixture();
    const bad = requestWave(f.region, f.authority.npcs, f.authority.waves, {
      seed: 1, count: 25, origin: { x: 0, y: 0, z: 0 },
    }, 0);
    expect(bad).toEqual({ ok: false, reason: "ai_budget" });
    expect(f.authority.npcs.size).toBe(0);

    const good = requestWave(f.region, f.authority.npcs, f.authority.waves, {
      seed: 1, count: NPC_MAX_ACTIVE_PER_REGION, origin: { x: 0, y: 0, z: 0 },
    }, 0);
    expect(good.ok).toBe(true);
    stepWaves(f.region, f.authority.npcs, f.authority.waves, 4, () => {}); // pre-roll
    for (let t = 5; t < 5 + NPC_MAX_ACTIVE_PER_REGION + 1; t++) {
      stepWaves(f.region, f.authority.npcs, f.authority.waves, t, () => {});
    }
    expect(f.authority.npcs.size).toBe(NPC_MAX_ACTIVE_PER_REGION);
    // Penuh → request berikutnya reject.
    const over = requestWave(f.region, f.authority.npcs, f.authority.waves, {
      seed: 2, count: 1, origin: { x: 0, y: 0, z: 0 },
    }, 99);
    expect(over).toEqual({ ok: false, reason: "ai_budget" });
  });

  it("6. AI internal-only: player kena damage TANPA satu pun intent pemain", () => {
    const f = fixture();
    spawnPirate(f);
    const before = f.player.vessel.systems.reduce((a, s) => a + s.health, 0);
    f.step(45); // tanpa enqueue intent apa pun
    const after = f.player.vessel.systems.reduce((a, s) => a + s.health, 0);
    expect(after).toBeLessThan(before);
    // Faction matrix: pirate hostil ke semua non-pirate; trader tidak hostil.
    expect(isHostile("pirate", "trader")).toBe(true);
    expect(isHostile("trader", "pirate")).toBe(false);
    expect(isHostile("pirate", "pirate")).toBe(false);
  });
});
