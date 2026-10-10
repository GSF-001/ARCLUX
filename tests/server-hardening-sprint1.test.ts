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

// Sprint 1 "Waras dulu" (08-server-hardening §4): regresi E-1..E-5 + auth
// P0-2 + rate/stability P0-4 + directory P0-5 + readBody 1MB.
// Tiap eksploit wajib punya test merah-ke-hijau (invariant §5.8).

import { afterEach, describe, expect, it } from "vitest";
import { createGameServer, sanitizeVesselModel, type GameServerHandle } from "../mmo/packages/gameserver/server";
import { createInMemoryPersistence } from "../mmo/packages/gameserver/persistence";
import {
  isDeliverAllowed,
  resolveAuthSecret,
  resolveHandoffSecret,
  signHandoff,
  signLoginToken,
} from "../mmo/packages/gameserver/auth";
import { WorldRegion } from "../mmo/packages/gameserver/world";
import { SimulationEngine } from "../mmo/packages/gameserver/simulation";
import { validateIntent, resolveTradeSeller } from "../mmo/packages/gameserver/validator";
import { STABILITY_LIMITS } from "../mmo/packages/gameserver/stability";
import {
  clearDirectory,
  effectiveStatus,
  heartbeat,
  listServersWithHealth,
} from "../mmo/packages/directory/registry";
import type { PlayerIntent } from "../mmo/packages/gameserver/types";
import type {
  ComponentBinding,
  SlotLayout,
  SystemState,
  VesselModel,
  VesselStatDerivation,
} from "../mmo/packages/universe/types";

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

function comp(id: string, owner = "p1"): ComponentBinding {
  return { id, capability: `cap.${id}`, license: "open", owner, provenance: [] };
}

function vesselModel(over?: Partial<VesselModel>): VesselModel {
  return {
    id: "v-sprint1",
    name: "Sprint Vessel",
    source: { org: "GSF-001", repo: "sprint", defaultBranch: "main", analyzedAt: "2026-10-06T00:00:00Z" },
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

function makeEngine(regionId = "r1") {
  const region = new WorldRegion(regionId, "Region");
  const engine = new SimulationEngine({
    region,
    dt: 0.1,
    authProvider: (pid) => ({ playerId: pid, auth: { actor: pid } }),
  });
  return { region, engine };
}

function intent(playerId: string, entityId: string, type: string, payload: Record<string, unknown>, seq = 1): PlayerIntent {
  return { playerId, entityId, type, payload, seq };
}

// ---------- HTTP harness ----------
const servers: GameServerHandle[] = [];

async function startServer(opts: Record<string, unknown> = {}): Promise<{ gs: GameServerHandle; url: string }> {
  const gs = createGameServer({
    regionId: "r-http",
    port: 0,
    register: false,
    ...opts,
  } as Parameters<typeof createGameServer>[0]);
  const { url } = await gs.start();
  servers.push(gs);
  return { gs, url };
}

async function post(url: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, body: json };
}

async function login(url: string, playerId: string): Promise<string> {
  const r = await post(url, "/login", { playerId });
  expect(r.status).toBe(200);
  return r.body.token as string;
}

afterEach(async () => {
  for (const gs of servers.splice(0)) {
    try { await gs.stop(); } catch { /* already stopped */ }
  }
  clearDirectory();
  STABILITY_LIMITS.maxEntities = 5000;
  STABILITY_LIMITS.maxEventLog = 10000;
  STABILITY_LIMITS.maxTickMs = 80;
});

// ---------- E-5: determinisme spawn_station ----------
describe("E-5 spawn_station determinisme", () => {
  it("id & posisi identik di dua run (seeded rng, bukan Date.now/Math.random)", () => {
    const run = () => {
      const { region, engine } = makeEngine("r1");
      region.spawnVessel({ id: "v-actor", owner: "p1", vessel: vesselModel(), position: { x: 100, y: 0, z: 200 } });
      engine.enqueue(intent("p1", "v-actor", "spawn_station", { name: "Arena" }));
      engine.step();
      const stations = [...region.snapshot().entities].filter((e) => e.kind === "station");
      expect(stations).toHaveLength(1);
      return { id: stations[0].id, position: stations[0].position };
    };
    const a = run();
    const b = run();
    expect(a.id).toMatch(/^r1:st:\d+:\d+$/);
    expect(a.id).not.toMatch(/^stadium:/);
    expect(b.id).toBe(a.id);
    expect(b.position).toEqual(a.position);
  });
});

// ---------- E-1: pencurian component via trade ----------
describe("E-1 trade_component ownership", () => {
  function tradeWorld() {
    const region = new WorldRegion("r1", "R");
    const engine = new SimulationEngine({
      region,
      dt: 0.1,
      authProvider: (pid) => ({ playerId: pid, auth: { actor: pid } }),
    });
    const seller = region.spawnVessel({ id: "v-a", owner: "p1", vessel: vesselModel({ id: "v-a", components: [comp("c1", "p1")] }) });
    const other = region.spawnVessel({ id: "v-b", owner: "p2", vessel: vesselModel({ id: "v-b", components: [] }) });
    return { region, engine, seller, other };
  }

  it("validator reject: aktor bukan pemilik vessel penjual", () => {
    const { region } = tradeWorld();
    const found = resolveTradeSeller(region, "c1");
    expect(found?.seller.id).toBe("v-a");
    const res = validateIntent(
      region,
      intent("p2", "v-b", "trade_component", { componentId: "c1", toVesselId: "v-b" }),
      { playerId: "p2", auth: { actor: "p2" } }
    );
    expect(res.decision).toBe("reject");
    expect(res.reason).toContain("does not own seller");
  });

  it("sim menolak & component tetap di penjual (defense-in-depth)", () => {
    const { region, engine, seller } = tradeWorld();
    engine.enqueue(intent("p2", "v-b", "trade_component", { componentId: "c1", toVesselId: "v-b" }));
    const result = engine.step();
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].payload.reason).toContain("does not own seller");
    expect(seller.vessel.components.some((c) => c.id === "c1")).toBe(true);
  });

  it("trade sah tetap jalan: pemilik memindahkan component ke vesselnya sendiri", () => {
    const { region, engine, seller } = tradeWorld();
    region.spawnVessel({ id: "v-a2", owner: "p1", vessel: vesselModel({ id: "v-a2", components: [] }) });
    engine.enqueue(intent("p1", "v-a", "trade_component", { componentId: "c1", toVesselId: "v-a2" }));
    const result = engine.step();
    expect(result.rejected).toHaveLength(0);
    expect(seller.vessel.components.some((c) => c.id === "c1")).toBe(false);
    expect(region.getVessel("v-a2")!.vessel.components.some((c) => c.id === "c1")).toBe(true);
    expect(result.accepted.some((e) => e.type === "intent_trade_component")).toBe(true);
    expect(engine.replayLog().some((e) => e.type === "trade")).toBe(true);
  });

  it("validator reject: componentId tidak ada di vessel manapun", () => {
    const { region } = tradeWorld();
    const res = validateIntent(
      region,
      intent("p1", "v-a", "trade_component", { componentId: "ghost" }),
      { playerId: "p1", auth: { actor: "p1" } }
    );
    expect(res.decision).toBe("reject");
    expect(res.reason).toContain("not found");
  });
});

// ---------- HTTP: auth P0-2 + E-4 seq + rate P0-4 ----------
describe("HTTP /login + /intent auth & idempotency", () => {
  it("/login mengeluarkan token yang valid", async () => {
    const { url } = await startServer();
    const token = await login(url, "p1");
    expect(token.split(".")).toHaveLength(2);
    const r = await post(url, "/login", {});
    expect(r.status).toBe(400);
  });

  it("intent TANPA token = 401; token expired = 401; token salah secret = 401", async () => {
    const { gs, url } = await startServer();
    gs.spawnPlayerVessel({ playerId: "p1", vessel: vesselModel() });
    const base = intent("p1", "v-sprint1", "scan", {});
    const noToken = await post(url, "/intent", base);
    expect(noToken.status).toBe(401);
    const expired = signLoginToken("p1", resolveAuthSecret(), -1);
    expect((await post(url, "/intent", base, { authorization: `Bearer ${expired}` })).status).toBe(401);
    const forged = signLoginToken("p1", "wrong-secret");
    expect((await post(url, "/intent", base, { authorization: `Bearer ${forged}` })).status).toBe(401);
  });

  it("playerId ≠ token subject → verdict rejected (validator identity mismatch)", async () => {
    const { gs, url } = await startServer();
    gs.spawnPlayerVessel({ playerId: "victim", vessel: vesselModel() });
    const attackerToken = await login(url, "attacker");
    const r = await post(
      url,
      "/intent",
      intent("victim", "v-sprint1", "scan", {}),
      { authorization: `Bearer ${attackerToken}` }
    );
    expect(r.status).toBe(200);
    expect(r.body.verdict).toBe("rejected");
    expect(r.body.reason).toContain("identity mismatch");
  });

  it("E-4: seq monotonik — replikasi seq yang sama/salah urut = 409, seq naik diterima", async () => {
    const { gs, url } = await startServer();
    gs.spawnPlayerVessel({ playerId: "p1", vessel: vesselModel() });
    const token = await login(url, "p1");
    const h = { authorization: `Bearer ${token}` };
    // Pakai `move` (bukan scan) — scan kini punya cooldown 10 tick (Sprint 2,
    // P1-3); E-4 menguji seq logic, bukan scan.
    const mv = (seq: number) => intent("p1", "v-sprint1", "move", { x: 4e9, y: 0, z: 0 }, seq);
    const ok = await post(url, "/intent", mv(1), h);
    expect(ok.status).toBe(200);
    expect(ok.body.verdict).toBe("accepted");
    const replay = await post(url, "/intent", mv(1), h);
    expect(replay.status).toBe(409);
    expect(replay.body.reason).toContain("stale");
    const backwards = await post(url, "/intent", mv(0), h);
    expect(backwards.status).toBe(409);
    const next = await post(url, "/intent", mv(2), h);
    expect(next.status).toBe(200);
    expect(next.body.verdict).toBe("accepted");
  });

  it("P0-4 rate limit: flood → 429 + shadowban (deny berikutnya tetap 429)", async () => {
    const { url } = await startServer();
    // Flood PARALEL: flood sekuensial gampang lolos saat latency tinggi
    // (bucket refill 20/s mengejar tiap request) — konkoransi bikin burst
    // pasti meledak melewati burst 40 walau di bawah CPU load penuh.
    const results = await Promise.all(
      Array.from({ length: 120 }, (_, i) => post(url, "/intent", intent("bot", "no-such-entity", "scan", {}, i + 1)))
    );
    const saw429 = results.some((r) => r.status === 429);
    const sawShadow = results.some((r) => r.status === 429 && r.body?.reason === "shadowbanned");
    expect(saw429).toBe(true);
    expect(sawShadow).toBe(true);
    const after = await post(url, "/intent", intent("bot", "no-such-entity", "scan", {}, 999));
    expect(after.status).toBe(429);
  }, 15_000);

  it("readBody 1MB: payload >1MB = 413", async () => {
    const { url } = await startServer();
    const big = JSON.stringify({ playerId: "p1", entityId: "x", type: "scan", payload: { pad: "a".repeat(1_500_000) }, seq: 1 });
    const r = await post(url, "/intent", big);
    expect(r.status).toBe(413);
  });
});

// ---------- E-2: /deliver HMAC + sanitasi ----------
describe("E-2 /deliver", () => {
  function deliverBody(vesselId = "d-1") {
    return { vesselId, owner: "relay", vessel: vesselModel({ id: vesselId }), position: { x: 1, y: 2, z: 3 } };
  }

  it("tanpa signature / signature salah / kadaluarsa / body ditamper = 403; valid = spawn", async () => {
    const { gs, url } = await startServer();
    const secret = resolveHandoffSecret();

    const unsigned = await post(url, "/deliver", deliverBody("d-1"));
    expect(unsigned.status).toBe(403);

    const wrong = await post(url, "/deliver", deliverBody("d-2"), { "x-arclux-handoff": signHandoff(JSON.stringify(deliverBody("d-2")), "other-secret") });
    expect(wrong.status).toBe(403);

    const staleRaw = JSON.stringify(deliverBody("d-3"));
    const stale = await post(url, "/deliver", staleRaw, { "x-arclux-handoff": signHandoff(staleRaw, secret, Date.now() - 120_000) });
    expect(stale.status).toBe(403);

    const signedRaw = JSON.stringify(deliverBody("d-4"));
    const tampered = await post(url, "/deliver", JSON.stringify({ ...deliverBody("d-4"), owner: "attacker" }), {
      "x-arclux-handoff": signHandoff(signedRaw, secret),
    });
    expect(tampered.status).toBe(403);

    const validRaw = JSON.stringify(deliverBody("d-5"));
    const ok = await post(url, "/deliver", validRaw, { "x-arclux-handoff": signHandoff(validRaw, secret) });
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
    expect(gs.region.has("d-5")).toBe(true);
  });

  it("D-008: stat wire TIDAK dipercaya — agregat dihitung ulang, health di-clamp", async () => {
    const { gs, url } = await startServer();
    const evil = vesselModel({
      id: "d-forge",
      integrity: 999,
      defense: -50,
      systems: [
        { id: "engine", label: "Engine", health: 150, baseStat: 70 },
        { id: "reactor", label: "Reactor", health: 150, baseStat: 80 },
        { id: "navigation", label: "Navigation", health: 60, baseStat: 60 },
        { id: "defense", label: "Defense", health: -20, baseStat: 75 },
        { id: "weapons", label: "Weapons", health: 65, baseStat: 65 },
        { id: "ai", label: "AI", health: 50, baseStat: 50 },
      ],
    });
    const raw = JSON.stringify({ vesselId: "d-forge", owner: "relay", vessel: evil, position: { x: 0, y: 0, z: 0 } });
    const r = await post(url, "/deliver", raw, { "x-arclux-handoff": signHandoff(raw) });
    expect(r.status).toBe(200);
    const spawned = gs.region.getVessel("d-forge")!;
    expect(spawned.vessel.integrity).toBe(100); // dari reactor health di-clamp, bukan wire 999
    expect(spawned.vessel.defense).toBe(0); // health -20 → clamp 0
    expect(spawned.vessel.systems.find((s) => s.id === "engine")!.health).toBe(100);
  });

  it("sanitizeVesselModel menolak struktur rusak", () => {
    expect(sanitizeVesselModel({ id: "", systems: [], components: [] } as unknown as VesselModel)).toBeNull();
    expect(sanitizeVesselModel({ ...vesselModel(), components: new Array(65).fill(comp("x")) } as unknown as VesselModel)).toBeNull();
    expect(sanitizeVesselModel(null as unknown as VesselModel)).toBeNull();
  });

  it("IP allowlist: loopback selalu boleh, remote butuh daftar", () => {
    expect(isDeliverAllowed("127.0.0.1")).toBe(true);
    expect(isDeliverAllowed("::1")).toBe(true);
    expect(isDeliverAllowed("::ffff:127.0.0.1")).toBe(true);
    expect(isDeliverAllowed("10.0.0.5")).toBe(false);
    expect(isDeliverAllowed("10.0.0.5", ["10.0.0.5"])).toBe(true);
    expect(isDeliverAllowed(undefined)).toBe(false);
  });
});

// ---------- E-3: lifecycle persistence ----------
describe("E-3 lifecycle persistence (D-013)", () => {
  it("save-on-stop lalu resume: vessel & tick kembali setelah restart", async () => {
    const store = createInMemoryPersistence();
    const opts = { regionId: "r-persist", port: 0, register: false, persistence: store };
    const gs1 = createGameServer(opts);
    await gs1.start();
    gs1.spawnPlayerVessel({ playerId: "p1", vessel: vesselModel() });
    await new Promise((r) => setTimeout(r, 350)); // biar tick jalan >0
    const savedTick = gs1.region.tick;
    expect(savedTick).toBeGreaterThan(0);
    await gs1.stop();
    servers.push(gs1);

    const gs2 = createGameServer(opts);
    await gs2.start();
    servers.push(gs2);
    expect(gs2.region.has("v-sprint1")).toBe(true);
    expect(gs2.region.tick).toBeGreaterThanOrEqual(savedTick);
  }, 10_000);

  it("autosave tiap 100 tick: snapshot tersedia dari store TANPA stop()", async () => {
    const store = createInMemoryPersistence();
    const gs = createGameServer({ regionId: "r-auto", port: 0, register: false, persistence: store, tickRate: 1000 });
    await gs.start();
    servers.push(gs);
    const deadline = Date.now() + 8_000;
    let snap: Awaited<ReturnType<typeof store.loadRegion>> = null;
    while (Date.now() < deadline) {
      snap = await store.loadRegion("r-auto");
      if (snap && snap.tick >= 100) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(snap).not.toBeNull();
    expect(snap!.tick).toBeGreaterThanOrEqual(100);
  }, 15_000);
});

// ---------- P0-4: stability guard ----------
describe("P0-4 stability guard", () => {
  it("entity cap: spawn_station ditolak + stability_trip tercatat", () => {
    STABILITY_LIMITS.maxEntities = 3;
    const { region, engine } = makeEngine("r-cap");
    for (let i = 0; i < 4; i++) {
      region.spawnVessel({ id: `v-${i}`, owner: "p1", vessel: vesselModel() });
    }
    engine.enqueue(intent("p1", "v-0", "spawn_station", { name: "Cap Arena" }));
    const result = engine.step();
    const log = engine.replayLog();
    expect(log.some((e) => e.type === "stability_trip" && e.payload.reason === "entity_cap")).toBe(true);
    expect(log.some((e) => e.type === "spawn_rejected" && e.payload.reason === "entity_cap")).toBe(true);
    expect([...region.snapshot().entities].filter((e) => e.kind === "station")).toHaveLength(0);
    expect(result.accepted.filter((e) => e.type === "intent_spawn_station")).toHaveLength(1); // intent lolos validator, spawn-nya yang ditolak
  });

  it("eventlog overflow: trip + rotate (log tidak meledak)", () => {
    STABILITY_LIMITS.maxEventLog = 50;
    STABILITY_LIMITS.maxTickMs = 10_000; // isolasi: jangan sampai tick_overbudget menang duluan
    const { region, engine } = makeEngine("r-log");
    region.spawnVessel({ id: "v-1", owner: "p1", vessel: vesselModel() });
    for (let i = 0; i < 60; i++) {
      engine.enqueue(intent("p1", "v-1", "scan", {}, i + 1));
    }
    engine.step(); // 60 intent_ + 60 scan_result = 120 event → melewati 50
    engine.step(); // awal step: trip + trim separuh
    const log = engine.replayLog();
    expect(log.some((e) => e.type === "stability_trip" && e.payload.reason === "eventlog_overflow")).toBe(true);
    expect(log.length).toBeLessThan(120); // ter-rotate, bukan menumpuk
  });
});

// ---------- P0-5: directory /servers + TTL ----------
describe("P0-5 directory /servers + heartbeat TTL", () => {
  it("server terdaftar ONLINE; heartbeat basi → OFFLINE; stop → hilang", async () => {
    const { url } = await startServer({ register: true, regionId: "r-dir" });
    const first = await fetch(`${url}/servers`).then((r) => r.json());
    const entry = first.servers.find((s: { serverId: string }) => s.serverId === "r-dir");
    expect(entry).toBeTruthy();
    expect(entry.status).toBe("ONLINE");

    // Backdate heartbeat 31 detik (TTL 30s) → efektif OFFLINE.
    heartbeat("r-dir", { status: "ONLINE" }, Date.now() - 31_000);
    expect(effectiveStatus("r-dir")).toBe("OFFLINE");
    const stale = await fetch(`${url}/servers?status=OFFLINE`).then((r) => r.json());
    expect(stale.servers.some((s: { serverId: string }) => s.serverId === "r-dir")).toBe(true);
    const online = await fetch(`${url}/servers?status=ONLINE`).then((r) => r.json());
    expect(online.servers.some((s: { serverId: string }) => s.serverId === "r-dir")).toBe(false);
    expect(listServersWithHealth().some((s) => s.serverId === "r-dir")).toBe(true);
  });
});
