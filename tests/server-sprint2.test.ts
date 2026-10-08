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

// Sprint 2 "Otoritas fitur" (08-server-hardening §4): tether P1-4, scan
// cooldown P1-3, activeMode P1-8, wanted P1-5, economy P1-6, hack P1-9,
// klaim radius P1-7, hapus dead code spawn P1-2, snapshot P2-4.

import { afterEach, describe, expect, it } from "vitest";
import { WorldRegion } from "../packages/gameserver/world";
import { SimulationEngine } from "../packages/gameserver/simulation";
import {
  validateIntent,
  SCAN_RANGE_MAX,
  FPS_TETHER_RADIUS_M,
  type AuthorityDeps,
} from "../packages/gameserver/validator";
import { createSessionStore, SHIP_ONLY_INTENTS } from "../packages/gameserver/session";
import { createClaimStore, CLAIM_PLANT_RADIUS_M, CLAIM_MAX_PER_PLAYER } from "../packages/gameserver/claims";
import {
  createHackStore,
  HACK_COOLDOWN_TICKS,
  HACK_MAX_FAILS,
  HACK_FAIL_ALARM_DELTA,
  HACK_WANTED_DELTA,
} from "../packages/gameserver/hack";
import { sanitizeSnapshot } from "../packages/gameserver/visibility";
import { createEconomy, ARCLUX_STORE, TAX_RATE, TREASURY_ID, TOPUP_MIN } from "../packages/economy";
import { createWantedStore, WANTED_DECAY_INTERVAL_TICKS, CRIME_WEIGHT, WANTED_MAX } from "../packages/wanted";
import { createGameServer, type GameServerHandle } from "../packages/gameserver/server";
import { clearDirectory } from "../packages/directory/registry";
import type { PlayerIntent, VesselEntity } from "../packages/gameserver/types";
import type { ComponentBinding, SlotLayout, SystemState, VesselModel, VesselStatDerivation } from "../packages/universe/types";

const SUBSYSTEMS: SystemState[] = [
  { id: "engine", label: "Engine", health: 70, baseStat: 70 },
  { id: "reactor", label: "Reactor", health: 80, baseStat: 80 },
  { id: "navigation", label: "Navigation", health: 60, baseStat: 60 },
  { id: "defense", label: "Defense", health: 75, baseStat: 75 },
  { id: "weapons", label: "Weapons", health: 65, baseStat: 65 },
  { id: "ai", label: "AI", health: 50, baseStat: 50 },
];

const SLOTS: SlotLayout = { engine: 4, reactor: 3, navigation: 3, defense: 4, weapons: 4, ai: 2 };

const DERIVATION: VesselStatDerivation = {
  integrity: [{ label: "test", value: 80, weight: 1 }],
  defense: [{ label: "test", value: 75, weight: 1 }],
  weapons: [{ label: "test", value: 65, weight: 1 }],
  engine: [{ label: "test", value: 70, weight: 1 }],
};

function comp(id: string, owner = "p1", license: ComponentBinding["license"] = "open"): ComponentBinding {
  return { id, capability: `cap.${id}`, license, owner, provenance: [`prov/${id}`], label: `Label ${id}` };
}

function vesselModel(over?: Partial<VesselModel>): VesselModel {
  return {
    id: "v-model",
    name: "Sprint2 Vessel",
    source: { org: "GSF-001", repo: "sprint2", defaultBranch: "main", analyzedAt: "2026-10-06T00:00:00Z" },
    license: "open",
    systems: SUBSYSTEMS.map((s) => ({ ...s })),
    components: [comp("c1")],
    integrity: 80,
    defense: 75,
    weapons: 65,
    engine: 70,
    derivation: DERIVATION,
    slotLayout: SLOTS,
    ...over,
  };
}

function makeAuthority(): AuthorityDeps {
  return {
    sessions: createSessionStore(),
    wanted: createWantedStore(),
    economy: createEconomy(),
    hacks: createHackStore(),
    claims: createClaimStore(),
  };
}

function makeEngine(regionId = "r1", authority?: AuthorityDeps) {
  const region = new WorldRegion(regionId, "Region");
  const auth = authority ?? makeAuthority();
  const engine = new SimulationEngine({
    region,
    dt: 0.1,
    authProvider: (pid) => ({ playerId: pid, auth: { actor: pid } }),
    authority: auth,
  });
  return { region, engine, authority: auth };
}

function ctxFor(playerId: string, authority?: AuthorityDeps) {
  return { playerId, auth: { actor: playerId }, authority };
}

function intent(playerId: string, entityId: string, type: string, payload: Record<string, unknown> = {}, seq = 1): PlayerIntent {
  return { playerId, entityId, type, payload, seq };
}

function accept(region: WorldRegion, i: PlayerIntent, authority?: AuthorityDeps): boolean {
  return validateIntent(region, i, ctxFor(i.playerId, authority)).decision === "accept";
}

function reason(region: WorldRegion, i: PlayerIntent, authority?: AuthorityDeps): string {
  return validateIntent(region, i, ctxFor(i.playerId, authority)).reason ?? "";
}

const servers: GameServerHandle[] = [];

afterEach(async () => {
  for (const gs of servers.splice(0)) {
    try { await gs.stop(); } catch { /* already stopped */ }
  }
  clearDirectory();
});

// ---------- P1-4 tether ----------
describe("P1-4 FPS tether (01 §5)", () => {
  it("karakter >1000m dari kapal induk DITOLAK; dalam radius diterima", () => {
    const { region, authority } = makeEngine("r-tether");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    region.spawnCharacter({ id: "char:p1", owner: "p1", vesselId: "v-1", position: { x: 0, y: 0, z: 0 } });

    const far = FPS_TETHER_RADIUS_M + 500;
    const rFar = reason(region, intent("p1", "char:p1", "move", { x: far, y: 0, z: 0 }), authority);
    expect(rFar).toContain("tether limit");
    expect(accept(region, intent("p1", "char:p1", "move", { x: 500, y: 0, z: 0 }), authority)).toBe(true);
  });

  it("karakter tanpa kapal induk (vesselId = charId) bebas", () => {
    const { region, authority } = makeEngine("r-tether2");
    region.spawnCharacter({ id: "char:p1", owner: "p1", vesselId: "char:p1", position: { x: 0, y: 0, z: 0 } });
    expect(accept(region, intent("p1", "char:p1", "move", { x: 9000, y: 0, z: 0 }), authority)).toBe(true);
  });
});

// ---------- P1-3 scan ----------
describe("P1-3 scan cooldown + range + payload minimal", () => {
  it("scan pertama OK + payload hanya {id,kind,faction}; cooldown menolak scan berikut", () => {
    const { region, engine, authority } = makeEngine("r-scan");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    region.spawnVessel({ id: "v-2", owner: "p2", vessel: vesselModel({ components: [comp("c2", "p2", "private")] }), position: { x: 100, y: 0, z: 0 } });

    engine.enqueue(intent("p1", "v-1", "scan", {}));
    const result = engine.step();
    expect(result.rejected).toHaveLength(0);
    const scanEv = engine.replayLog().find((e) => e.type === "scan_result");
    expect(scanEv).toBeTruthy();
    const nearby = scanEv!.payload.nearby as Array<Record<string, unknown>>;
    expect(nearby.map((n) => n.id)).toContain("v-2");
    for (const n of nearby) {
      expect(Object.keys(n).sort()).toEqual(["faction", "id", "kind"]); // tanpa posisi/label/detail
    }

    // Cooldown: scan kedua ditolak validator.
    expect(reason(region, intent("p1", "v-1", "scan", {}, 2), authority)).toContain("scan on cooldown");
    engine.enqueue(intent("p1", "v-1", "scan", {}, 2));
    const r2 = engine.step();
    expect(r2.rejected.some((e) => String(e.payload.reason).startsWith("scan on cooldown"))).toBe(true);

    // Range dibatasi validator (cooldown dibersihkan dulu — cek range terpisah).
    (region.get("v-1") as VesselEntity).cooldowns["scan"] = 0;
    expect(reason(region, intent("p1", "v-1", "scan", { range: SCAN_RANGE_MAX + 1 }), authority)).toContain("scan range");
    expect(reason(region, intent("p1", "v-1", "scan", { range: -5 }), authority)).toContain("scan range");
  });

  it("cooldown berkurang per tick — scan sah lagi setelah 10 tick", () => {
    const { region, engine } = makeEngine("r-scan2");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    engine.enqueue(intent("p1", "v-1", "scan", {}));
    engine.step();
    for (let i = 0; i < 10; i++) engine.step();
    expect((region.get("v-1") as VesselEntity).cooldowns["scan"] ?? 0).toBe(0);
    expect(accept(region, intent("p1", "v-1", "scan", {}, 3))).toBe(true);
  });
});

// ---------- P1-8 activeMode ----------
describe("P1-8 activeMode SHIP/FPS (06 §2.5)", () => {
  it("spawn_character → fps; attack ship ditolak, fps_switch_mode membebaskan", () => {
    const { region, engine, authority } = makeEngine("r-mode");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    region.spawnVessel({ id: "v-target", owner: "p2", vessel: vesselModel({ components: [comp("c2", "p2")] }), position: { x: 100, y: 0, z: 0 } });
    expect(authority.sessions.modeOf("p1")).toBe("ship");

    engine.enqueue(intent("p1", "v-1", "spawn_character", {}));
    engine.step();
    expect(authority.sessions.modeOf("p1")).toBe("fps");
    expect(region.has("char:p1")).toBe(true);

    // Ship-only intent ditolak saat fps.
    const atk = intent("p1", "v-1", "attack", { targetId: "v-target", weapon: "laser" });
    expect(reason(region, atk, authority)).toContain("requires ship mode");
    expect(SHIP_ONLY_INTENTS.has("spawn_character")).toBe(false);

    // fps_switch_mode → ship → attack legal lagi.
    engine.enqueue(intent("p1", "v-1", "fps_switch_mode", { mode: "ship" }, 2));
    engine.step();
    expect(authority.sessions.modeOf("p1")).toBe("ship");
    expect(accept(region, atk, authority)).toBe(true);
  });

  it("dock ditolak saat mode fps (06 §2.5 gate)", () => {
    const { region, authority } = makeEngine("r-mode2");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    region.spawnStation({ id: "st-1", name: "St", owner: "npc", position: { x: 100, y: 0, z: 0 }, safeZoneRadius: 1000 });
    authority.sessions.setMode("p1", "fps");
    expect(reason(region, intent("p1", "v-1", "dock", { stationId: "st-1" }), authority)).toContain("requires ship mode");
    authority.sessions.setMode("p1", "ship");
    expect(accept(region, intent("p1", "v-1", "dock", { stationId: "st-1" }), authority)).toBe(true);
  });
});

// ---------- P1-5 wanted ----------
describe("P1-5 wanted (05 §2)", () => {
  it("tanpa saksi = tanpa record; dengan saksi naik sesuai bobot, cap 5", () => {
    const w = createWantedStore();
    const none = w.escalate("p1", { crime: "kill", witnessed: false, tick: 1 });
    expect(none.applied).toBe(false);
    expect(w.levelOf("p1")).toBe(0);

    w.escalate("p1", { crime: "kill", witnessed: true, tick: 1 });
    expect(w.levelOf("p1")).toBe(CRIME_WEIGHT.kill);
    w.escalate("p1", { crime: "theft", witnessed: true, tick: 2 });
    w.escalate("p1", { crime: "kill", witnessed: true, tick: 3 });
    expect(w.levelOf("p1")).toBe(WANTED_MAX); // cap
  });

  it("kill saat kapal hancur → wanted_escalated (saksi = korban)", () => {
    const { region, engine, authority } = makeEngine("r-kill");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    const victim = region.spawnVessel({ id: "v-2", owner: "p2", vessel: vesselModel({ components: [comp("c2", "p2")] }), position: { x: 100, y: 0, z: 0 } });
    for (const s of victim.vessel.systems) s.health = 0; // hull 0 = hancur

    engine.enqueue(intent("p1", "v-1", "attack", { targetId: "v-2", weapon: "laser" }));
    const res = engine.step();
    expect(res.rejected).toHaveLength(0);
    const log = engine.replayLog();
    expect(log.some((e) => e.type === "vessel_destroyed" && e.payload.entityId === "v-2")).toBe(true);
    expect(log.some((e) => e.type === "wanted_escalated")).toBe(true);
    expect(authority.wanted.levelOf("p1")).toBe(CRIME_WEIGHT.kill);
  });

  it("gerbang kota: level ≥3 tolak dock; blacklist per communityId", () => {
    const { region, authority } = makeEngine("r-gate");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    region.spawnStation({ id: "st-1", name: "Kota", owner: "npc", communityId: "city-a", position: { x: 100, y: 0, z: 0 }, safeZoneRadius: 1000 });

    expect(accept(region, intent("p1", "v-1", "dock", { stationId: "st-1" }), authority)).toBe(true);
    authority.wanted.escalate("p1", { crime: "kill", witnessed: true, tick: 1 }); // level 3
    expect(reason(region, intent("p1", "v-1", "dock", { stationId: "st-1" }), authority)).toContain("akses kota ditolak");

    authority.wanted.clear("p1");
    authority.wanted.addBlacklist("city-a", "p1");
    expect(reason(region, intent("p1", "v-1", "dock", { stationId: "st-1" }), authority)).toContain("blacklisted");
    authority.wanted.releaseBlacklist("city-a", "p1");
    expect(accept(region, intent("p1", "v-1", "dock", { stationId: "st-1" }), authority)).toBe(true);
  });

  it("decay: 1 level per interval tunable; record hilang di 0", () => {
    const w = createWantedStore();
    const I = WANTED_DECAY_INTERVAL_TICKS;
    w.escalate("p1", { crime: "kill", witnessed: true, tick: 0 }); // 3
    w.decay(I - 1);
    expect(w.levelOf("p1")).toBe(3);
    w.decay(I); // due 2I
    expect(w.levelOf("p1")).toBe(2);
    w.decay(2 * I); // due 3I
    expect(w.levelOf("p1")).toBe(1);
    w.decay(3 * I); // level 0 → record dihapus
    expect(w.getRecord("p1")).toBeUndefined();
  });
});

// ---------- P1-6 economy ----------
describe("P1-6 economy OC (06 §1)", () => {
  it("topup minimum, transfer pajak 5% ke treasury, idempotency replay", () => {
    const eco = createEconomy();
    expect(eco.topup("p1", TOPUP_MIN - 1).ok).toBe(false);
    expect(eco.topup("p1", 1000).ok).toBe(true);

    const t1 = eco.transfer({ from: "p1", to: "p2", amount: 200, idempotencyKey: "tx-1", tick: 5 });
    expect(t1.ok).toBe(true);
    const tax = Math.floor(200 * TAX_RATE);
    expect(eco.balanceOf("p2")).toBe(200 - tax);
    expect(eco.balanceOf(TREASURY_ID)).toBe(tax);

    const t2 = eco.transfer({ from: "p1", to: "p2", amount: 200, idempotencyKey: "tx-1", tick: 6 });
    expect(t2.ok).toBe(true);
    if (t2.ok) expect(t2.replayed).toBe(true);
    expect(eco.balanceOf("p2")).toBe(200 - tax); // tidak dobel

    expect(eco.transfer({ from: "p2", to: "p3", amount: 999999 }).ok).toBe(false);
    expect(eco.txLog().filter((t) => t.kind === "p2p")).toHaveLength(1); // ledger append-only
  });

  it("buy_arclux via intent: debit harga katalog + item origin arclux", () => {
    const { region, engine, authority } = makeEngine("r-buy");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    authority.economy.topup("p1", 5000);

    engine.enqueue(intent("p1", "v-1", "buy_arclux", { itemId: "rifle" }));
    const res = engine.step();
    expect(res.rejected).toHaveLength(0);
    expect(authority.economy.balanceOf("p1")).toBe(5000 - ARCLUX_STORE.rifle.price);
    const items = authority.economy.itemsOf("p1");
    expect(items).toHaveLength(1);
    expect(items[0].origin).toBe("arclux");
    expect(items[0].durability).toBe(100);
    const log = engine.replayLog();
    expect(log.some((e) => e.type === "purchase")).toBe(true);
    expect(log.some((e) => e.type === "wallet_changed")).toBe(true);
  });

  it("validator tolak OC cost kurang + item tak dikenal", () => {
    const { region, authority } = makeEngine("r-buy2");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    expect(reason(region, intent("p1", "v-1", "buy_arclux", { itemId: "rifle" }), authority)).toContain("insufficient OC");
    expect(reason(region, intent("p1", "v-1", "buy_arclux", { itemId: "nope" }), authority)).toContain("unknown store item");
  });

  it("sell_player: OC pindah + pajak + component berpindah", () => {
    const { region, engine, authority } = makeEngine("r-sell");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    region.spawnVessel({ id: "v-2", owner: "p2", vessel: vesselModel({ components: [comp("c-buyer", "p2")] }), position: { x: 50, y: 0, z: 0 } });
    authority.economy.topup("p2", 1000);

    engine.enqueue(intent("p1", "v-1", "sell_player", { componentId: "c1", toPlayerId: "p2", price: 100 }));
    const res = engine.step();
    expect(res.rejected).toHaveLength(0);
    expect(authority.economy.balanceOf("p2")).toBe(900);
    expect(authority.economy.balanceOf("p1")).toBe(95);
    expect(authority.economy.balanceOf(TREASURY_ID)).toBe(5);
    const buyer = region.getVessel("v-2")!;
    expect(buyer.vessel.components.some((c) => c.id === "c1")).toBe(true);
    expect(region.getVessel("v-1")!.vessel.components.some((c) => c.id === "c1")).toBe(false);
  });

  it("sell_player ditolak: harga non-integer, self trade, buyer miskin", () => {
    const { region, authority } = makeEngine("r-sell2");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    expect(reason(region, intent("p1", "v-1", "sell_player", { componentId: "c1", toPlayerId: "p2", price: 10.5 }), authority)).toContain("integer");
    expect(reason(region, intent("p1", "v-1", "sell_player", { componentId: "c1", toPlayerId: "p1", price: 10 }), authority)).toContain("self trade");
    expect(reason(region, intent("p1", "v-1", "sell_player", { componentId: "c1", toPlayerId: "p2", price: 10 }), authority)).toContain("insufficient OC");
  });
});

// ---------- P1-9 hack ----------
describe("P1-9 hack (06 §3)", () => {
  it("range + safe zone + cooldown ditolak validator", () => {
    const { region, authority } = makeEngine("r-hack1");
    region.spawnVessel({ id: "v-hacker", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    region.spawnVessel({ id: "v-far", owner: "p2", vessel: vesselModel({ components: [comp("c2", "p2")] }), position: { x: 500, y: 0, z: 0 } });
    expect(reason(region, intent("p1", "v-hacker", "hack_start", { targetId: "v-far", targetType: "engine" }), authority)).toContain("out of range");

    const hacker = region.getVessel("v-hacker")!;
    hacker.cooldowns[`hack:v-far`] = HACK_COOLDOWN_TICKS;
    hacker.position = { x: 497, y: 0, z: 0 }; // dekat v-far
    expect(reason(region, intent("p1", "v-hacker", "hack_start", { targetId: "v-far", targetType: "engine" }), authority)).toContain("on cooldown");
    hacker.cooldowns[`hack:v-far`] = 0;
    expect(accept(region, intent("p1", "v-hacker", "hack_start", { targetId: "v-far", targetType: "engine" }), authority)).toBe(true);

    expect(reason(region, intent("p1", "v-hacker", "hack_start", { targetId: "v-far", targetType: "toilet" }), authority)).toContain("targetType");
  });

  it("sukses: urutan deterministik → efek engine-disable + wanted delta", () => {
    const { region, engine, authority } = makeEngine("r-hack2");
    region.spawnVessel({ id: "v-hacker", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    region.spawnVessel({ id: "v-target", owner: "p2", vessel: vesselModel({ components: [comp("c2", "p2")] }), position: { x: 5, y: 0, z: 0 } });

    engine.enqueue(intent("p1", "v-hacker", "hack_start", { targetId: "v-target", targetType: "engine" }));
    const res1 = engine.step();
    expect(res1.rejected).toHaveLength(0);
    const attempt = authority.hacks.get("p1");
    expect(attempt).toBeTruthy();
    expect(attempt!.sequence.length).toBeGreaterThanOrEqual(4);
    expect(attempt!.sequence.length).toBeLessThanOrEqual(6);

    let n = 0;
    for (const key of attempt!.sequence) {
      engine.enqueue(intent("p1", "v-hacker", "hack_input", { keyIndex: key }, ++n));
      engine.step();
    }
    const log = engine.replayLog();
    expect(log.some((e) => e.type === "hack_effect" && e.payload.targetType === "engine")).toBe(true);
    expect(authority.hacks.get("p1")).toBeUndefined(); // attempt selesai
    // Efek: mesin target mati 30 detik (3000 tick) — validator `move` tolak.
    const target = region.getVessel("v-target")!;
    expect(target.cooldowns["engines"]).toBeGreaterThan(0);
    expect(reason(region, intent("p2", "v-target", "move", { x: 0, y: 0, z: 0 }), authority)).toContain("engines disabled");
    // Wanted delta engine (tabel 06 §3.4) dengan saksi (korbannya sendiri).
    expect(authority.wanted.levelOf("p1")).toBe(HACK_WANTED_DELTA.engine);
  });

  it("salah tombol → hack_failed; 3 fail berturut → alarm + wanted +2", () => {
    const { region, engine, authority } = makeEngine("r-hack3");
    region.spawnVessel({ id: "v-hacker", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    region.spawnVessel({ id: "v-target", owner: "p2", vessel: vesselModel({ components: [comp("c2", "p2")] }), position: { x: 5, y: 0, z: 0 } });

    for (let n = 1; n <= HACK_MAX_FAILS; n++) {
      engine.enqueue(intent("p1", "v-hacker", "hack_start", { targetId: "v-target", targetType: "door" }, n * 2 - 1));
      engine.step();
      const attempt = authority.hacks.get("p1")!;
      const wrong = (attempt.sequence[0] + 1) % 6;
      engine.enqueue(intent("p1", "v-hacker", "hack_input", { keyIndex: wrong }, n * 2));
      engine.step();
      // Cooldown 60s per target: reset manual agar fail beruntun bisa diuji
      // (aturan 3-fail diuji terlepas dari durasi cooldown).
      region.getVessel("v-hacker")!.cooldowns["hack:v-target"] = 0;
    }
    const log = engine.replayLog();
    expect(log.filter((e) => e.type === "hack_failed")).toHaveLength(HACK_MAX_FAILS);
    expect(log.some((e) => e.type === "hack_effect" && e.payload.targetType === "alarm" && e.payload.cause === "3 consecutive fails")).toBe(true);
    expect(authority.wanted.levelOf("p1")).toBe(HACK_FAIL_ALARM_DELTA);
  });

  it("hack_input tanpa attempt ditolak; cancel menghapus attempt", () => {
    const { region, engine, authority } = makeEngine("r-hack4");
    region.spawnVessel({ id: "v-hacker", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    region.spawnVessel({ id: "v-target", owner: "p2", vessel: vesselModel({ components: [comp("c2", "p2")] }), position: { x: 5, y: 0, z: 0 } });

    engine.enqueue(intent("p1", "v-hacker", "hack_input", { keyIndex: 0 }));
    const res = engine.step();
    expect(res.rejected.some((e) => e.payload.reason === "no active hack attempt")).toBe(true);

    engine.enqueue(intent("p1", "v-hacker", "hack_start", { targetId: "v-target", targetType: "door" }, 2));
    engine.step();
    expect(authority.hacks.get("p1")).toBeTruthy();
    engine.enqueue(intent("p1", "v-hacker", "hack_cancel", {}, 3));
    engine.step();
    expect(authority.hacks.get("p1")).toBeUndefined();
    expect(engine.replayLog().some((e) => e.type === "hack_cancelled")).toBe(true);
  });
});

// ---------- P1-7 klaim radius ----------
describe("P1-7 klaim tanah radius (02 §8.5/§9.4)", () => {
  it("klaim sah dalam radius; tolak terlalu jauh / berimpit / anti-serakah", () => {
    const { region, engine, authority } = makeEngine("r-claim");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });

    engine.enqueue(intent("p1", "v-1", "claim_land", { x: 100, z: 100 }));
    let res = engine.step();
    expect(res.rejected).toHaveLength(0);
    expect(authority.claims.countFor("p1")).toBe(1);
    expect(engine.replayLog().some((e) => e.type === "land_claimed")).toBe(true);

    // Terlalu jauh.
    expect(reason(region, intent("p1", "v-1", "claim_land", { x: CLAIM_PLANT_RADIUS_M + 1, z: 0 }), authority)).toContain("too far");
    // Berimpit (beda <100m).
    expect(reason(region, intent("p1", "v-1", "claim_land", { x: 150, z: 150 }), authority)).toContain("overlaps");
    // Klaim 2 & 3 sah → di-apply; ke-4 ditolak anti-serakah.
    engine.enqueue(intent("p1", "v-1", "claim_land", { x: 500, z: 0 }, 2));
    res = engine.step();
    expect(res.rejected).toHaveLength(0);
    engine.enqueue(intent("p1", "v-1", "claim_land", { x: 0, z: 500 }, 3));
    res = engine.step();
    expect(res.rejected).toHaveLength(0);
    expect(authority.claims.countFor("p1")).toBe(CLAIM_MAX_PER_PLAYER);
    expect(reason(region, intent("p1", "v-1", "claim_land", { x: -500, z: 0 }), authority)).toContain(`maks ${CLAIM_MAX_PER_PLAYER}`);
  });
});

// ---------- P1-2 dead code spawn ----------
describe("P1-2 intent spawn dihapus (validator default-reject)", () => {
  it("type spawn tidak dikenal validator — dead code sim sudah dihapus", () => {
    const { region, engine, authority } = makeEngine("r-spawn");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel(), position: { x: 0, y: 0, z: 0 } });
    expect(reason(region, intent("p1", "v-1", "spawn", {}), authority)).toContain("unsupported intent");
    engine.enqueue(intent("p1", "v-1", "spawn", {}));
    const res = engine.step();
    expect(res.accepted).toHaveLength(0);
    expect(res.rejected).toHaveLength(1);
  });
});

// ---------- P2-4 snapshot sanitasi ----------
describe("P2-4 snapshot sanitasi per-pemirsa", () => {
  function snapshotFixture() {
    const { region } = makeEngine("r-vis");
    region.spawnVessel({ id: "v-own", owner: "p1", vessel: vesselModel({ components: [comp("c-open", "p1", "open"), comp("c-priv", "p1", "private")] }), position: { x: 0, y: 0, z: 0 } });
    region.spawnStation({ id: "st-1", name: "St", owner: "npc", position: { x: 10, y: 0, z: 0 }, safeZoneRadius: 1000 });
    return region.snapshot();
  }

  it("viewer=owner penuh; viewer lain → komponen non-public redact {id,capability}", () => {
    const snap = snapshotFixture();
    const full = sanitizeSnapshot(snap, "p1");
    const privFull = full.entities.find((e) => e.id === "v-own") as VesselEntity;
    expect(privFull.vessel.components.find((c) => c.id === "c-priv")).toHaveProperty("label");

    const red = sanitizeSnapshot(snap, "p2");
    const v = red.entities.find((e) => e.id === "v-own") as VesselEntity;
    const priv = v.vessel.components.find((c) => c.id === "c-priv")!;
    expect(Object.keys(priv).sort()).toEqual(["capability", "id"]); // tanpa label/provenance/license/owner
    const open = v.vessel.components.find((c) => c.id === "c-open")!;
    expect(open).toHaveProperty("license"); // open tetap penuh
    // Snapshot asli TIDAK dimutasi.
    const orig = snap.entities.find((e) => e.id === "v-own") as VesselEntity;
    expect(orig.vessel.components.find((c) => c.id === "c-priv")).toHaveProperty("label");
  });

  it("tanpa viewer (anonim) → legacy penuh; /snapshot ?playerId= menegakkan redact", async () => {
    const gs = createGameServer({ regionId: "r-vis-http", port: 0, register: false });
    servers.push(gs);
    const { url } = await gs.start();
    gs.spawnPlayerVessel({ playerId: "p1", vessel: vesselModel({ id: "v-one", components: [comp("c-priv", "p1", "private")] }) });

    const anon = await fetch(`${url}/snapshot`).then((r) => r.json());
    const anonV = anon.entities.find((e: { id: string }) => e.id === "v-one");
    expect(anonV.vessel.components[0]).toHaveProperty("label");

    const asOther = await fetch(`${url}/snapshot?playerId=p2`).then((r) => r.json());
    const redV = asOther.entities.find((e: { id: string }) => e.id === "v-one");
    expect(Object.keys(redV.vessel.components[0]).sort()).toEqual(["capability", "id"]);
  });
});
