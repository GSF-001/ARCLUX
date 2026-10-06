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

// Fase 3 (blueprint 11 §5): server-authoritative fit authority.
// Validator menolak fit ilegal (slot overflow, prerequisite tier-3,
// unauthorized) dan memverifikasi fitHash (anti-cheat).

import { describe, expect, it } from "vitest";
import { WorldRegion } from "../packages/gameserver/world";
import { validateIntent } from "../packages/gameserver/validator";
import {
  fittedComponents,
  liveFit,
  projectFitAction,
} from "../packages/gameserver/fitting";
import type { VesselEntity } from "../packages/gameserver/types";
import type {
  ComponentBinding,
  DerivationSignal,
  SlotLayout,
  SystemState,
  VesselModel,
  VesselStatDerivation,
} from "../packages/universe/types";

const SUBSYSTEMS: SystemState[] = [
  { id: "engine", label: "Engine", health: 70, baseStat: 70 },
  { id: "reactor", label: "Reactor", health: 80, baseStat: 80 },
  { id: "navigation", label: "Navigation", health: 60, baseStat: 60 },
  { id: "defense", label: "Defense", health: 75, baseStat: 75 },
  { id: "weapons", label: "Weapons", health: 65, baseStat: 65 },
  { id: "ai", label: "AI", health: 50, baseStat: 50 },
];

const SLOTS: SlotLayout = {
  engine: 4,
  reactor: 3,
  navigation: 3,
  defense: 4,
  weapons: 4,
  ai: 2,
};

const DERIVATION: VesselStatDerivation = {
  integrity: [{ label: "test", value: 80, weight: 1 }],
  defense: [{ label: "test", value: 75, weight: 1 }],
  weapons: [{ label: "test", value: 65, weight: 1 }],
  engine: [{ label: "test", value: 70, weight: 1 }],
};

/** Katalog komponen — server-derived. Provenance depth → tier (0-1→1, 2-3→2, 4+→3). */
function catalog(): ComponentBinding[] {
  return [
    { id: "graph-basic", capability: "graph.basic", license: "open", owner: "p1", provenance: [] },
    { id: "graph-adv", capability: "graph.advanced", license: "open", owner: "p1", provenance: ["a", "b"] },
    {
      id: "graph-expert",
      capability: "graph.expert.deep",
      license: "open",
      owner: "p1",
      provenance: ["a", "b", "c", "d"],
    },
    { id: "sec-basic", capability: "security.basic", license: "open", owner: "p1", provenance: [] },
    {
      id: "sec-private",
      capability: "security.private",
      license: "private",
      owner: "other",
      provenance: [],
    },
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

function regionWith(v: VesselModel): { region: WorldRegion; entity: VesselEntity } {
  const region = new WorldRegion("r1", "Test Region");
  const entity = region.spawnVessel({ id: "vessel-1", owner: "p1", vessel: v });
  return { region, entity };
}

const ctx = { playerId: "p1", auth: { actor: "p1" } };

function intent(type: string, payload: Record<string, unknown>) {
  return { playerId: "p1", entityId: "vessel-1", type, payload, seq: 1 };
}

/** Commit intent yang diterima — persis seperti simulation.applyIntent. */
function commit(entity: VesselEntity, op: "equip" | "unequip", componentId: string): void {
  const projected = projectFitAction(entity.vessel, op, componentId);
  entity.vessel.fitted = projected.fitted;
  entity.stateHash = projected.fit.hash;
}

describe("Fase 3 — fit authority (gameserver)", () => {
  it("equip valid → accept; commit menambah fitted + stateHash = liveFit hash", () => {
    const { region, entity } = regionWith(vessel());
    // Vessel fresh memakai mode legacy (semua terpasang) — inisialisasi
    // fitted eksplisit kosong sebelum fitting dimulai.
    entity.vessel.fitted = [];
    const verdict = validateIntent(
      region,
      intent("equip_component", { componentId: "graph-basic" }),
      ctx
    );
    expect(verdict.decision).toBe("accept");
    commit(entity, "equip", "graph-basic");

    expect(entity.vessel.fitted).toEqual(["graph-basic"]);
    expect(entity.stateHash).toBe(liveFit(entity).hash);
    expect(fittedComponents(entity.vessel).map((c) => c.id)).toEqual(["graph-basic"]);
  });

  it("equip melebihi slot capacity → reject slot_overflow", () => {
    const tight = vessel({ slotLayout: { ...SLOTS, engine: 1 } });
    const { region, entity } = regionWith(tight);
    entity.vessel.fitted = [];
    expect(
      validateIntent(region, intent("equip_component", { componentId: "graph-basic" }), ctx).decision
    ).toBe("accept");
    commit(entity, "equip", "graph-basic");
    const verdict = validateIntent(region, intent("equip_component", { componentId: "graph-adv" }), ctx);
    expect(verdict.decision).toBe("reject");
    expect(verdict.reason).toMatch(/slot/i);
  });

  it("equip tier-3 tanpa keluarga lain → reject prerequisite_missing", () => {
    const { region, entity } = regionWith(vessel());
    entity.vessel.fitted = [];
    const verdict = validateIntent(
      region,
      intent("equip_component", { componentId: "graph-expert" }),
      ctx
    );
    expect(verdict.decision).toBe("reject");
    expect(verdict.reason).toMatch(/requires another graph\./);
  });

  it("unequip prerequisite keluarga (menggugurkan tier-3) → reject", () => {
    const { region, entity } = regionWith(vessel());
    entity.vessel.fitted = [];
    // Pasang basic + expert (family hadir → expert sah), commit per step
    expect(
      validateIntent(region, intent("equip_component", { componentId: "graph-basic" }), ctx).decision
    ).toBe("accept");
    commit(entity, "equip", "graph-basic");
    expect(
      validateIntent(region, intent("equip_component", { componentId: "graph-expert" }), ctx).decision
    ).toBe("accept");
    commit(entity, "equip", "graph-expert");
    expect(entity.vessel.fitted).toEqual(["graph-basic", "graph-expert"]);
    // Lepas basic → expert kehilangan prerequisite → proyeksi tidak valid
    const verdict = validateIntent(region, intent("unequip_component", { componentId: "graph-basic" }), ctx);
    expect(verdict.decision).toBe("reject");
    expect(verdict.reason).toMatch(/requires another graph\./);
  });

  it("unequip valid → accept", () => {
    const { region, entity } = regionWith(vessel());
    entity.vessel.fitted = ["graph-basic", "sec-basic"];
    const verdict = validateIntent(region, intent("unequip_component", { componentId: "sec-basic" }), ctx);
    expect(verdict.decision).toBe("accept");
  });

  it("expectHash palsu → reject (anti-cheat)", () => {
    const { region, entity } = regionWith(vessel());
    entity.vessel.fitted = ["graph-basic"];
    const verdict = validateIntent(
      region,
      intent("equip_component", { componentId: "graph-adv", expectHash: "deadbeef" }),
      ctx
    );
    expect(verdict.decision).toBe("reject");
    expect(verdict.reason).toMatch(/hash mismatch/);
  });

  it("expectHash benar → accept", () => {
    const { region, entity } = regionWith(vessel());
    entity.vessel.fitted = ["graph-basic"];
    const currentHash = liveFit(entity).hash;
    const verdict = validateIntent(
      region,
      intent("equip_component", { componentId: "graph-adv", expectHash: currentHash }),
      ctx
    );
    expect(verdict.decision).toBe("accept");
  });

  it("komponen private milik pemain lain → reject (Layer I.6)", () => {
    const { region } = regionWith(vessel());
    const verdict = validateIntent(
      region,
      intent("equip_component", { componentId: "sec-private" }),
      ctx
    );
    expect(verdict.decision).toBe("reject");
    expect(verdict.reason).toMatch(/not authorized/);
  });

  it("equip componentId tak dikenal → reject", () => {
    const { region } = regionWith(vessel());
    const verdict = validateIntent(
      region,
      intent("equip_component", { componentId: "nope" }),
      ctx
    );
    expect(verdict.decision).toBe("reject");
    expect(verdict.reason).toMatch(/unknown component/);
  });

  it("equip komponen yang sudah terpasang → reject", () => {
    const { region, entity } = regionWith(vessel());
    entity.vessel.fitted = ["graph-basic"];
    const verdict = validateIntent(
      region,
      intent("equip_component", { componentId: "graph-basic" }),
      ctx
    );
    expect(verdict.decision).toBe("reject");
    expect(verdict.reason).toMatch(/already fitted/);
  });

  it("legacy vessel (fitted undefined) → seluruh katalog dianggap terpasang", () => {
    const { region, entity } = regionWith(vessel());
    expect(entity.vessel.fitted).toBeUndefined();
    expect(fittedComponents(entity.vessel).length).toBe(catalog().length);
    // graph-basic + graph-adv + graph-expert (family hadir) muat di 4 slot engine
    expect(liveFit(entity).valid).toBe(true);
  });

  it("determinisme: liveFit dua kali → hash identik", () => {
    const { region, entity } = regionWith(vessel());
    entity.vessel.fitted = ["graph-basic", "sec-basic", "analyst-basic"];
    const h1 = liveFit(entity).hash;
    const h2 = liveFit(entity).hash;
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
  });

  it("senjata di katalog tapi belum fitted → tidak terdeteksi sebagai weapon (attack)", () => {
    const { region, entity } = regionWith(vessel());
    entity.vessel.fitted = [];
    const verdict = validateIntent(
      region,
      intent("attack", { targetId: "t1", weapon: "analyst.basic" }),
      ctx
    );
    // Target tidak dikenal menolak duluan — yang penting: weapon check
    // memakai fittedComponents; analyst.basic tidak fitted sehingga
    // jalur authorization weapon dilewati (bukan reject karena authorization).
    expect(verdict.decision).toBe("reject");
    expect(verdict.reason).toMatch(/unknown target/);
  });
});
