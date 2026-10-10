// Copyright 2026 GSF-001
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Fase 3 sisa (blueprint 11 §5): kapasitor server-side per tick +
// resistensi fit mengurangi damage di combat.

import { describe, expect, it } from "vitest";
import { capStep, simulateCapacitor, capacitorBudget } from "../mmo/packages/universe/capSim";
import { computeResists, deriveComponentDefinition } from "../mmo/packages/universe/fitCalc";
import { WorldRegion } from "../mmo/packages/gameserver/world";
import { SimulationEngine } from "../mmo/packages/gameserver/simulation";
import { applyCombatIntent, DAMAGE_CEILING } from "../mmo/packages/gameserver/combat";
import { stepCapacitor, fitDefinitionsOf, CAP_REGEN_AT_FULL } from "../mmo/packages/gameserver/fitting";
import { registerCapability, getCapability } from "../mmo/packages/gameserver/capability";
import type { VesselEntity, PlayerIntent } from "../mmo/packages/gameserver/types";
import type {
  ComponentBinding,
  SlotLayout,
  SystemState,
  VesselModel,
  VesselStatDerivation,
} from "../mmo/packages/universe/types";

const SUBSYSTEMS: SystemState[] = [
  { id: "engine", label: "Engine", health: 70, baseStat: 70 },
  { id: "reactor", label: "Reactor", health: 100, baseStat: 80 },
  { id: "navigation", label: "Navigation", health: 60, baseStat: 60 },
  { id: "defense", label: "Defense", health: 75, baseStat: 75 },
  { id: "weapons", label: "Weapons", health: 100, baseStat: 65 },
  { id: "ai", label: "AI", health: 50, baseStat: 50 },
];

const SLOTS: SlotLayout = { engine: 4, reactor: 3, navigation: 3, defense: 4, weapons: 4, ai: 2 };

const DERIVATION: VesselStatDerivation = {
  integrity: [{ label: "t", value: 80, weight: 1 }],
  defense: [{ label: "t", value: 75, weight: 1 }],
  weapons: [{ label: "t", value: 65, weight: 1 }],
  engine: [{ label: "t", value: 70, weight: 1 }],
};

/** Katalog: defense comps (missile resist), engine comps (draw), weapon. */
function catalog(): ComponentBinding[] {
  return [
    { id: "sec-basic", capability: "security.basic", license: "open", owner: "p1", provenance: [] },
    { id: "sec-adv", capability: "security.advanced", license: "open", owner: "p1", provenance: ["a", "b"] },
    { id: "graph-basic", capability: "graph.basic", license: "open", owner: "p1", provenance: [] },
    { id: "analyst-basic", capability: "analyst.basic", license: "open", owner: "p1", provenance: [] },
  ];
}

function vessel(over?: Partial<VesselModel>): VesselModel {
  return {
    id: "vessel-1",
    name: "Test Vessel",
    source: { org: "GSF-001", repo: "test", defaultBranch: "main", analyzedAt: "2026-01-01T00:00:00Z" },
    license: "open",
    systems: SUBSYSTEMS.map((s) => ({ ...s })),
    components: catalog(),
    integrity: 80,
    defense: 75,
    weapons: 65,
    engine: 70,
    derivation: DERIVATION,
    slotLayout: SLOTS,
    ...over,
  };
}

function spawn(v: VesselModel, id: string): { region: WorldRegion; entity: VesselEntity } {
  const region = new WorldRegion("r1", "Test Region");
  const entity = region.spawnVessel({ id, owner: "p1", vessel: v });
  return { region, entity };
}

describe("Fase 3 sisa — kapasitor server-side", () => {
  it("capStep: formula clamp+round2 (satu rumus untuk klien & server)", () => {
    expect(capStep(50, 10, 4, 100)).toBe(44);
    expect(capStep(5, 10, 4, 100)).toBe(0); // clamp floor
    expect(capStep(99, 0, 4, 100)).toBe(100); // clamp ceiling
    expect(capStep(50.555, 1, 0.333, 100)).toBe(49.89); // round2
  });

  it("simulateCapacitor memakai capStep — hasil identik rantai per-tick", () => {
    const state = { capacity: 100, current: 50, regenPerTick: 4 };
    const sim = simulateCapacitor(state, 10, 3);
    // 50 → 44 → 38 → 32
    let manual = 50;
    for (let i = 0; i < 3; i++) manual = capStep(manual, 10, 4, 100);
    expect(sim.endLevel).toBe(manual);
    expect(sim.endLevel).toBe(32);
  });

  it("stepCapacitor: init lazy dari reactor (capacity=baseStat, regen=health%)", () => {
    const { entity } = spawn(vessel(), "v1");
    entity.vessel.fitted = []; // katalog legacy terpasang semua — kosongkan dulu
    expect(entity.capacitor).toBeUndefined();
    const res = stepCapacitor(entity);
    // reactor baseStat 80 → capacity 80; health 100% → regen = CAP_REGEN_AT_FULL
    expect(res.capacity).toBe(80);
    expect(res.regen).toBe(CAP_REGEN_AT_FULL);
    expect(entity.capacitor?.capacity).toBe(80);
    expect(entity.capacitor?.current).toBe(80); // start full: 80 - 0 + 4 → clamp 80
  });

  it("stepCapacitor: fit berat (draw > regen) → drain lalu depletion", () => {
    const { entity } = spawn(vessel(), "v1");
    entity.vessel.fitted = ["sec-basic", "sec-adv", "graph-basic", "analyst-basic"];
    // powerDraw per comp: t1=3, t2=6 → 3+6+3+3 = 15/tick vs regen 4
    const draw = capacitorBudget(fitDefinitionsOf(entity.vessel));
    expect(draw).toBe(15);
    let newlySeen = 0;
    let drained = 0;
    for (let i = 0; i < 60; i++) {
      const res = stepCapacitor(entity);
      if (res.newlyDepleted) newlySeen++;
      if (res.current === 0) drained++;
    }
    expect(newlySeen).toBe(1); // hanya sekali menyeberang ke 0
    expect(drained).toBeGreaterThan(0); // lalu tetap 0 (draw > regen)
    expect(entity.capacitor?.current).toBe(0);
  });

  it("stepCapacitor: determinisme — dua run identik, state awal tak di-mutate", () => {
    const a = spawn(vessel(), "v1");
    const b = spawn(vessel(), "v1");
    a.entity.vessel.fitted = ["sec-basic", "graph-basic"];
    b.entity.vessel.fitted = ["sec-basic", "graph-basic"];
    const ra = stepCapacitor(a.entity);
    const rb = stepCapacitor(b.entity);
    expect(ra).toEqual(rb);
    expect(a.entity.capacitor).toEqual(b.entity.capacitor);
  });

  it("simulateCapacitor tidak memutasi input state (purity)", () => {
    const state = { capacity: 100, current: 50, regenPerTick: 4 };
    simulateCapacitor(state, 20, 10);
    expect(state).toEqual({ capacity: 100, current: 50, regenPerTick: 4 });
  });

  it("gate: kapasitor 0 → activate_capability ditolak (capability tidak terpakai)", () => {
    const region = new WorldRegion("r1", "Test Region");
    const v = vessel({
      systems: SUBSYSTEMS.map((s) => (s.id === "reactor" ? { ...s, health: 0 } : { ...s })),
    });
    const entity = region.spawnVessel({ id: "vessel-1", owner: "p1", vessel: v });
    entity.vessel.fitted = [];
    entity.capacitor = { capacity: 80, current: 0, regenPerTick: 0 };
    registerCapability("vessel-1", "capital"); // supaya canActivate lolos tanpa gate

    const sim = new SimulationEngine({
      region,
      authProvider: (playerId) => ({ playerId, auth: { actor: playerId } }),
    });
    const intent: PlayerIntent = {
      playerId: "p1",
      entityId: "vessel-1",
      type: "activate_capability",
      payload: {},
      seq: 1,
    };
    sim.enqueue(intent);
    const result = sim.step();
    // Intent diterima validator, tapi applyIntent memblokir via gate.
    expect(getCapability("vessel-1")?.activationsUsed).toBe(0);
    expect(result.rejected.length).toBe(0);
    // Kapasitor tetap 0 setelah tick (regen 0, draw 0).
    expect(entity.capacitor?.current).toBe(0);
  });

  it("gate: kapasitor terisi → activate_capability jalan (aktivasi terpakai)", () => {
    const region = new WorldRegion("r1", "Test Region");
    const v = vessel({
      systems: SUBSYSTEMS.map((s) => (s.id === "reactor" ? { ...s, health: 100 } : { ...s })),
    });
    const entity = region.spawnVessel({ id: "vessel-1", owner: "p1", vessel: v });
    entity.vessel.fitted = [];
    entity.capacitor = { capacity: 80, current: 80, regenPerTick: 4 };
    registerCapability("vessel-1", "capital");

    const sim = new SimulationEngine({
      region,
      authProvider: (playerId) => ({ playerId, auth: { actor: playerId } }),
    });
    sim.enqueue({
      playerId: "p1",
      entityId: "vessel-1",
      type: "activate_capability",
      payload: {},
      seq: 1,
    });
    sim.step();
    expect(getCapability("vessel-1")?.activationsUsed).toBe(1);
  });
});

describe("Fase 3 sisa — resistensi fit di combat", () => {
  /** Attacker weapons health 100 → attackPower = 4 + 8 = 12. */
  function spawnPair(targetV: VesselModel, targetId: string, attackerId: string) {
    const { region, entity: target } = spawn(targetV, targetId);
    const a = region.spawnVessel({ id: attackerId, owner: "p1", vessel: vessel() });
    return { region, target, attacker: a };
  }

  function attack(region: WorldRegion, attackerId: string, targetId: string, weapon: string) {
    return applyCombatIntent(region, region.getVessel(attackerId)!, {
      playerId: "p1",
      entityId: attackerId,
      type: "attack",
      payload: { targetId, weapon },
      seq: 1,
    });
  }

  it("target tanpa fit → damage polos (tanpa resist)", () => {
    const { region, target } = spawnPair(vessel({ fitted: [] }), "target-bare", "attacker-1");
    const impact = attack(region, "attacker-1", "target-bare", "weapon.missile");
    expect(impact).toBeDefined();
    expect(impact!.damage).toBe(12); // raw 12, ceiling 12, health 75
    expect(impact!.resisted).toBe(0);
    expect(target.vessel.systems.find((s) => s.id === "defense")!.health).toBe(63);
  });

  it("target dengan defense fit → missile damage berkurang (resist fitCalc)", () => {
    const { region, target } = spawnPair(
      vessel({ fitted: ["sec-basic", "sec-adv"] }),
      "target-armored",
      "attacker-2"
    );
    const impact = attack(region, "attacker-2", "target-armored", "weapon.missile");
    // resist missile = 0.05(t1) + 0.10(t2) = 0.15 → 12 × 0.85 = 10.2
    const resists = computeResists(fitDefinitionsOf(target.vessel));
    expect(resists.missile).toBeCloseTo(0.15, 5);
    expect(impact!.resisted).toBeCloseTo(1.8, 5);
    expect(impact!.damage).toBeCloseTo(10.2, 5);
    expect(impact!.damage).toBeLessThan(12);
    expect(impact!.damage).toBeLessThanOrEqual(DAMAGE_CEILING);
  });

  it("resist mempengaruhi subsistem yang DITARGET (defense→defense)", () => {
    const { region } = spawnPair(
      vessel({ fitted: ["sec-basic", "sec-adv"] }),
      "t2",
      "attacker-3"
    );
    const impact = attack(region, "attacker-3", "t2", "weapon.missile");
    expect(impact!.subsystemId).toBe("defense");
    expect(impact!.destroyed).toBe(false);
  });

  it("weapon tak dikenal → jalur polos (perilaku lama dipertahankan)", () => {
    const { region } = spawnPair(
      vessel({ fitted: ["sec-basic", "sec-adv"] }),
      "t3",
      "attacker-4"
    );
    const impact = attack(region, "attacker-4", "t3", "weapon.laser");
    expect(impact!.subsystemId).toBe("defense"); // default resolve
    expect(impact!.resisted).toBe(0);
    expect(impact!.damage).toBe(12);
  });

  it("resist menghormati ceiling MAX_RESIST — damage tidak pernah di bawah 40% raw", () => {
    const { region } = spawnPair(
      vessel({ fitted: ["sec-basic", "sec-adv"], slotLayout: { ...SLOTS, defense: 2 } }),
      "t4",
      "attacker-5"
    );
    const impact = attack(region, "attacker-5", "t4", "weapon.missile");
    // 12 × (1 − min(0.6, resist)) ≥ 12 × 0.4 = 4.8
    expect(impact!.damage).toBeGreaterThanOrEqual(4.8);
  });
});
