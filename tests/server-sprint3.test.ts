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

// Sprint 3 "Skala" (08-server-hardening §4): P2-1 interest+delta, P2-2
// event store, P2-3 time dilation, P2-5 anti-desync, P2-6 re-sim harness,
// P2-7 WebSocket sungguhan, P2-8 schemaVersion, P2-9 API iterasi entity,
// P3-3 safe-zone cached.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WorldRegion } from "../mmo/packages/gameserver/world";
import {
  SimulationEngine,
  DILATION_SCALES,
  computeEntityHash,
} from "../mmo/packages/gameserver/simulation";
import { validateIntent } from "../mmo/packages/gameserver/validator";
import { createMemoryEventStore, createJsonlEventStore } from "../mmo/packages/gameserver/eventStore";
import { resimulate } from "../mmo/packages/gameserver/replay";
import { worldHash, STABILITY_LIMITS } from "../mmo/packages/gameserver/stability";
import {
  SNAPSHOT_SCHEMA_VERSION,
  type PlayerIntent,
  type RegionSnapshot,
} from "../mmo/packages/gameserver/types";
import { isValidResume, migrateSnapshot, loadAndResume } from "../mmo/packages/gameserver/regionState";
import { createInMemoryPersistence } from "../mmo/packages/gameserver/persistence";
import { createGameServer, type GameServerHandle } from "../mmo/packages/gameserver/server";
import { clearDirectory } from "../mmo/packages/directory/registry";
import type { VesselModel } from "../mmo/packages/universe/types";

const SUBSYSTEMS = [
  { id: "engine", label: "Engine", health: 70, baseStat: 70 },
  { id: "reactor", label: "Reactor", health: 80, baseStat: 80 },
  { id: "navigation", label: "Navigation", health: 60, baseStat: 60 },
  { id: "defense", label: "Defense", health: 75, baseStat: 75 },
  { id: "weapons", label: "Weapons", health: 65, baseStat: 65 },
  { id: "ai", label: "AI", health: 50, baseStat: 50 },
];

function vesselModel(id: string): VesselModel {
  return {
    id,
    name: `Sprint3 ${id}`,
    source: { org: "GSF-001", repo: "sprint3", defaultBranch: "main", analyzedAt: "2026-10-08T00:00:00Z" },
    license: "open",
    systems: SUBSYSTEMS.map((s) => ({ ...s })),
    components: [],
    integrity: 80,
    defense: 75,
    weapons: 65,
    engine: 70,
  } as unknown as VesselModel;
}

const authProvider = (playerId: string) => ({ playerId, auth: { actor: playerId } });

function makeEngine(region: WorldRegion, over?: Partial<ConstructorParameters<typeof SimulationEngine>[0]>) {
  return new SimulationEngine({ region, authProvider, ...over });
}

const servers: GameServerHandle[] = [];
const tmpDirs: string[] = [];

afterEach(async () => {
  for (const gs of servers.splice(0)) {
    try { await gs.stop(); } catch { /* already stopped */ }
  }
  clearDirectory();
  for (const d of tmpDirs.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe("Sprint 3 — Skala (P2-* / P3-3)", () => {
  it("P2-9: API iterasi entity resmi (eachEntity/values/vessels/stations/characters/size)", () => {
    const region = new WorldRegion("r-api", "API");
    region.spawnVessel({ id: "v1", vessel: vesselModel("v1"), owner: "p1" });
    region.spawnVessel({ id: "v2", vessel: vesselModel("v2"), owner: "p2" });
    region.spawnStation({ id: "s1", name: "Stadion" });
    region.spawnCharacter({ id: "c1", vesselId: "v1", owner: "p1" });

    expect(region.size()).toBe(4);
    expect(region.vessels().length).toBe(2);
    expect(region.stations().length).toBe(1);
    expect(region.characters().length).toBe(1);
    let seen = 0;
    region.eachEntity(() => { seen += 1; });
    expect(seen).toBe(4);
    expect([...region.values()].length).toBe(4);
    expect(region.vessels().every((v) => v.kind === "vessel")).toBe(true);
  });

  it("P3-3: safe-zone pakai cache stations — invalidasi saat remove", () => {
    const region = new WorldRegion("r-sz", "SZ");
    const attacker = region.spawnVessel({ id: "atk", vessel: vesselModel("atk"), owner: "p1", position: { x: 3000, y: 0, z: 0 } });
    const target = region.spawnVessel({ id: "tgt", vessel: vesselModel("tgt"), owner: "p2", position: { x: 500, y: 0, z: 0 } });
    region.spawnStation({ id: "sta", name: "Safe", position: { x: 0, y: 0, z: 0 }, safeZoneRadius: 1000 });
    expect(region.stations().length).toBe(1);

    const intent: PlayerIntent = { playerId: "p1", entityId: attacker.id, type: "attack", payload: { targetId: target.id, weapon: "laser" }, seq: 1 };
    const ctx = { playerId: "p1", auth: { actor: "p1" } };
    const v1 = validateIntent(region, intent, ctx);
    expect(v1.decision).toBe("reject");
    expect(v1.reason).toContain("safe zone");

    // Hapus station → cache invalidasi → serangan legal (range 2500 ≤ 5000).
    expect(region.remove("sta")).toBe(true);
    expect(region.stations().length).toBe(0);
    const v2 = validateIntent(region, intent, ctx);
    expect(v2.decision).toBe("accept");
  });

  it("P2-8: snapshot membawa schemaVersion; isValidResume tolak versi depan; migrateSnapshot isi yang hilang", () => {
    const region = new WorldRegion("r-ver", "Ver");
    const snap = region.snapshot();
    expect(snap.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);

    // Snapshot lama (tanpa schemaVersion) = valid + di-migrate.
    const legacy: RegionSnapshot = { regionId: "r-ver", name: "Ver", tick: 5, createdAt: snap.createdAt, entities: [] };
    expect(isValidResume(legacy)).toBe(true);
    expect(migrateSnapshot(legacy).schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);

    // Versi depan → server lama tak boleh restore.
    const future: RegionSnapshot = { ...legacy, schemaVersion: SNAPSHOT_SCHEMA_VERSION + 1 };
    expect(isValidResume(future)).toBe(false);
  });

  it("P2-8: loadAndResume restore snapshot legacy & tolak versi depan", async () => {
    const store = createInMemoryPersistence();
    const region = new WorldRegion("r-resume", "Resume");
    region.spawnVessel({ id: "v1", vessel: vesselModel("v1"), owner: "p1" });
    const snap = region.snapshot();
    const legacy = { ...snap } as RegionSnapshot;
    delete (legacy as { schemaVersion?: number }).schemaVersion;
    await store.saveRegion("r-resume", legacy);

    const restored = await loadAndResume(store, "r-resume");
    expect(restored).not.toBeNull();
    expect(restored!.has("v1")).toBe(true);

    await store.saveRegion("r-resume", { ...snap, schemaVersion: SNAPSHOT_SCHEMA_VERSION + 1 });
    const rejected = await loadAndResume(store, "r-resume");
    expect(rejected).toBeNull();
  });

  it("P2-2: memory event store append/replay/rotate", () => {
    const store = createMemoryEventStore(4);
    const mk = (tick: number) => ({ id: `e${tick}`, regionId: "r", tick, type: "t", payload: {}, timestamp: "" });
    store.append(mk(1));
    store.append(mk(2));
    store.append(mk(3));
    expect(store.size()).toBe(3);
    expect(store.replay(2).map((e) => e.tick)).toEqual([2, 3]);
    store.rotate();
    expect(store.replay().length).toBeGreaterThanOrEqual(2);
  });

  it("P2-2: JSONL store append-only + replay dari disk + rotate per file", () => {
    const dir = mkdtempSync(join(tmpdir(), "arclux-evstore-"));
    tmpDirs.push(dir);
    const store = createJsonlEventStore({ dir, regionId: "r-jsonl", maxEventsPerFile: 2 });
    const mk = (tick: number) => ({ id: `e${tick}`, regionId: "r-jsonl", tick, type: "t", payload: { n: tick }, timestamp: "2026-10-08T00:00:00Z" });
    store.append(mk(1));
    store.append(mk(2));
    store.append(mk(3)); // rotate ke file kedua
    store.size(); // flush sisa queue ke disk (durability boundary ≤64 event)

    const fresh = createJsonlEventStore({ dir, regionId: "r-jsonl" });
    const all = fresh.replay();
    expect(all.map((e) => e.tick)).toEqual([1, 2, 3]);
    expect(fresh.replay(3).map((e) => e.tick)).toEqual([3]);
  });

  it("P2-2: engine.log masuk event store & replayLog baca dari store", () => {
    const region = new WorldRegion("r-eng-store", "EngStore");
    const store = createMemoryEventStore();
    const engine = makeEngine(region, { eventStore: store });
    engine.enqueue({ playerId: "p1", entityId: region.spawnVessel({ id: "v1", vessel: vesselModel("v1"), owner: "p1" }).id, type: "move", payload: { x: 100, y: 0, z: 0 }, seq: 1 });
    engine.step();
    expect(store.size()).toBeGreaterThan(0);
    expect(engine.replayLog().some((e) => e.type.startsWith("intent_"))).toBe(true);
  });

  it("P2-1: delta snapshot — changedSince/removedSince menandai spawn gerak hapus", () => {
    const region = new WorldRegion("r-delta", "Delta");
    region.spawnVessel({ id: "a", vessel: vesselModel("a"), owner: "p1", position: { x: 0, y: 0, z: 0 } });
    region.spawnVessel({ id: "b", vessel: vesselModel("b"), owner: "p2", position: { x: 9e4, y: 0, z: 0 } });
    region.spawnVessel({ id: "c", vessel: vesselModel("c"), owner: "p3", position: { x: -9e4, y: 0, z: 0 } });
    const engine = makeEngine(region);

    engine.step(); // tick 0 → 1: spawn stamps flushed (tick+1 = 1)
    const d1 = region.changedSince(0);
    expect(d1.map((e) => e.id).sort()).toEqual(["a", "b", "c"]);

    // Step diam (velocity 0, tanpa intent) → tak ada perubahan.
    engine.step(); // tick 1 → 2
    expect(region.changedSince(1)).toEqual([]);

    // Move intent → velocity non-zero → masuk delta.
    engine.enqueue({ playerId: "p1", entityId: "a", type: "move", payload: { x: 500, y: 0, z: 0 }, seq: 1 });
    engine.step(); // tick 2 → 3
    const d3 = region.changedSince(2).map((e) => e.id);
    expect(d3).toContain("a");
    expect(d3).not.toContain("b");

    // Hapus → removedSince.
    region.remove("c");
    region.advanceTick(); // flush removal stamp (tick 4)
    expect(region.removedSince(3)).toEqual(["c"]);
  });

  it("P2-3: ladder time-dilation naik saat overbudget, turun saat recover, broadcast via region + TickResult", () => {
    const region = new WorldRegion("r-tidi", "TiDi");
    const engine = makeEngine(region, { tickBudgetMs: 80, dilationRecoverTicks: 3 });

    engine.observeTickDuration(200);
    expect(engine.dilation).toEqual({ level: 1, scale: 0.5 });
    expect(region.dilation).toEqual({ level: 1, scale: 0.5 });

    engine.observeTickDuration(300);
    expect(engine.dilation).toEqual({ level: 2, scale: 0.25 });
    expect(DILATION_SCALES[2]).toBe(0.25);

    // Overbudget lagi di level max → tetap 2 (cap).
    engine.observeTickDuration(999);
    expect(engine.dilation.level).toBe(2);

    // 3 tick under-budget berturut → turun ke 1; 3 lagi → 0.
    for (let i = 0; i < 3; i++) engine.observeTickDuration(1);
    expect(engine.dilation.level).toBe(1);
    for (let i = 0; i < 3; i++) engine.observeTickDuration(1);
    expect(engine.dilation).toEqual({ level: 0, scale: 1 });

    // Broadcast: log region_dilated + snapshot membawa dilation.
    const log = engine.replayLog().filter((e) => e.type === "region_dilated");
    expect(log.length).toBeGreaterThanOrEqual(3);
    expect(region.snapshot().dilation).toEqual({ level: 0, scale: 1 });

    // TickResult membawa dilation (contract client).
    const res = engine.step();
    expect(res.dilation).toEqual({ level: 0, scale: 1 });
  });

  it("P2-5: computeEntityHash mencakup heading & emergency", () => {
    const region = new WorldRegion("r-hash", "Hash");
    const v = region.spawnVessel({ id: "v1", vessel: vesselModel("v1"), owner: "p1" });
    const h0 = computeEntityHash(v);
    v.heading.yaw = 1.5;
    const h1 = computeEntityHash(v);
    expect(h1).not.toBe(h0);
    v.emergency = { state: "adrift", updatedTick: 1, cause: "test" };
    const h2 = computeEntityHash(v);
    expect(h2).not.toBe(h1);
  });

  it("P2-5: /intent verify_hash — mismatch → resync + serverHash; match → desync_ok", async () => {
    const gs = createGameServer({ regionId: "r-desync", port: 0, register: false, auth: false, eventStore: false, ws: false });
    servers.push(gs);
    const { url } = await gs.start();
    const spawned = gs.spawnPlayerVessel({ playerId: "p1", vessel: vesselModel("v-desync"), position: { x: 1e10, y: 0, z: 0 } });
    // Bekukan drift supaya hash stabil antara request (tanpa tick-dependent
    // fields di computeEntityHash).
    spawned.velocity = { x: 0, y: 0, z: 0 };

    const wrong = await fetch(`${url}/intent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: "p1", entityId: "v-desync", type: "verify_hash", payload: { hash: "bogus" }, seq: 1 }),
    }).then((r) => r.json());
    expect(wrong.ok).toBe(true);
    expect(wrong.verdict).toBe("desync_mismatch");
    expect(wrong.resync).toBe(true);
    expect(typeof wrong.serverHash).toBe("string");

    const serverHash = computeEntityHash(gs.region.getVessel("v-desync")!);
    const ok = await fetch(`${url}/intent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: "p1", entityId: "v-desync", type: "verify_hash", payload: { hash: serverHash }, seq: 2 }),
    }).then((r) => r.json());
    expect(ok.verdict).toBe("desync_ok");
    expect(ok.resync).toBe(false);

    // P2-5b: desync_check masuk replay log (audit trail).
    expect(gs.engine.replayLog().filter((e) => e.type === "desync_check").length).toBe(2);
  });

  it("P2-6: re-simulasi harness — dua replika dari log sama → worldHash identik", () => {
    const region = new WorldRegion("r-replay", "Replay");
    region.spawnVessel({ id: "v1", vessel: vesselModel("v1"), owner: "p1", position: { x: 0, y: 0, z: 0 } });
    region.spawnVessel({ id: "v2", vessel: vesselModel("v2"), owner: "p2", position: { x: 2e4, y: 0, z: 0 } });
    const engine = makeEngine(region);
    // snapshot() = live refs (pre-existing): clone SEBELUM engine jalan,
    // kalau tidak `initial` ikut termutasi 6 step berikutnya.
    const initial: RegionSnapshot = structuredClone(region.snapshot());

    const intents: PlayerIntent[] = [
      { playerId: "p1", entityId: "v1", type: "move", payload: { x: 1e4, y: 0, z: 0 }, seq: 1 },
      { playerId: "p2", entityId: "v2", type: "move", payload: { x: 1e4, y: 500, z: 0 }, seq: 1 },
    ];
    for (let t = 0; t < 6; t++) {
      if (t === 1) for (const i of intents) engine.enqueue({ ...i, seq: i.seq + 10 * t });
      engine.step();
    }
    const log = engine.replayLog();
    expect(log.some((e) => e.type.startsWith("intent_"))).toBe(true);

    const hashA = resimulate(initial, log, { authProvider, untilTick: region.tick });
    const hashB = resimulate(initial, log, { authProvider, untilTick: region.tick });
    expect(hashA).toBe(hashB);
    expect(hashA).toBe(worldHash(region));

    // Kontrol: replay dari log kosong → hash berbeda (tak ada gerak).
    const hashEmpty = resimulate(initial, [], { authProvider, untilTick: region.tick });
    expect(hashEmpty).not.toBe(hashA);
  });

  it("P2-7: WS gateway — snapshot saat connect, ping→pong, delta broadcast tiap tick", async () => {
    const gs = createGameServer({ regionId: "r-ws", port: 0, register: false, auth: false, eventStore: false });
    servers.push(gs);
    const { url, port } = await gs.start();
    // 1e10: DI LUAR radius bintang (6.95e8 di origin) — spawn di dalam bintang
    // kena collision damage per tick (hash/state tak stabil).
    gs.spawnPlayerVessel({ playerId: "p1", vessel: vesselModel("v-ws"), position: { x: 1e10, y: 0, z: 0 } });

    const { socket, readFrame } = await wsConnect(port);

    // Snapshot penuh langsung setelah connect.
    const snap = await readFrame();
    expect(snap.type).toBe("snapshot");
    expect(snap.snapshot.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(snap.snapshot.entities.length).toBeGreaterThan(0);

    // ping → pong (delta broadcast interleaved — baca sampe ketemu pong).
    socket.write(wsClientFrame(JSON.stringify({ type: "ping" })));
    let pong: { type?: string } | null = null;
    for (let i = 0; i < 30; i++) {
      const msg = await readFrame();
      if (msg.type === "pong") {
        pong = msg;
        break;
      }
    }
    expect(pong).not.toBeNull();

    // Gerakkan vessel → tick berikutnya broadcast delta berisi entity.
    await fetch(`${url}/intent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: "p1", entityId: "v-ws", type: "move", payload: { x: 5e3, y: 0, z: 0 }, seq: 1 }),
    });
    let delta: { type: string; entities?: Array<{ id: string }> } | null = null;
    for (let i = 0; i < 20; i++) {
      const msg = await readFrame();
      if (msg.type === "delta") {
        delta = msg;
        if ((msg.entities ?? []).some((e: { id: string }) => e.id === "v-ws")) break;
      }
    }
    expect(delta).not.toBeNull();
    expect(delta!.type).toBe("delta");
    expect((delta!.entities ?? []).some((e) => e.id === "v-ws")).toBe(true);

    socket.destroy();
  });

  it("P2-1: /snapshot ?lastTick → delta + removed (HTTP)", async () => {
    const gs = createGameServer({ regionId: "r-http-delta", port: 0, register: false, auth: false, eventStore: false, ws: false });
    servers.push(gs);
    const { url } = await gs.start();
    gs.spawnPlayerVessel({ playerId: "p1", vessel: vesselModel("v1"), position: { x: 1e4, y: 0, z: 0 } });
    gs.spawnPlayerVessel({ playerId: "p2", vessel: vesselModel("v2"), position: { x: 2e5, y: 0, z: 0 } });

    // Full snapshot (tanpa lastTick) legacy — kedua vessel ada.
    const full = await fetch(`${url}/snapshot`).then((r) => r.json());
    expect(full.entities.length).toBe(2);

    // Tunggu ≥1 tick supaya spawn stamps ter-flush.
    await new Promise((r) => setTimeout(r, 150));
    const tickNow = gs.region.tick;

    // Hapus v2 → delta sejak tickNow wajib berisi removed.
    gs.region.remove("v2");
    await new Promise((r) => setTimeout(r, 150));
    const delta = await fetch(`${url}/snapshot?lastTick=${tickNow}`).then((r) => r.json());
    expect(delta.removed).toContain("v2");
    // v1 diam (drift kecil spawnPlayerVessel: velocity {8,0,3} → tetap changed).
    expect(delta.tick).toBeGreaterThan(tickNow);
  });

  it("limit: STABILITY_LIMITS tetap konsemen dengan ladder (budget = maxTickMs)", () => {
    expect(STABILITY_LIMITS.maxTickMs).toBe(80);
  });
});

// --- RFC6455 client minimal untuk test ---

function wsClientFrame(text: string): Buffer {
  const payload = Buffer.from(text, "utf8");
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const masked = Buffer.allocUnsafe(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]);
  }
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 0x80 | 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, mask, masked]);
}

async function wsConnect(port: number): Promise<{ socket: net.Socket; readFrame: () => Promise<any> }> {
  const socket = net.connect(port, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
  socket.write(
    "GET /ws HTTP/1.1\r\n" +
      `Host: 127.0.0.1:${port}\r\n` +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
      "Sec-WebSocket-Version: 13\r\n\r\n"
  );

  // Reader permanen: akumulasi chunk → queue frame lengkap → waiter.
  // (on/off listener per-frame bikin stream pause & miss data di Node.)
  let buffer = Buffer.alloc(0);
  let headersDone = false;
  const queue: any[] = [];
  let waiter: ((v: any) => void) | null = null;

  const drain = (): void => {
    while (buffer.length >= 2) {
      let len = buffer[1] & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (buffer.length < 4) return;
        len = buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (buffer.length < 10) return;
        len = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (buffer.length < offset + len) return;
      const payload = buffer.subarray(offset, offset + len).toString("utf8");
      buffer = buffer.subarray(offset + len);
      const frame = JSON.parse(payload);
      if (waiter) {
        const w = waiter;
        waiter = null;
        w(frame);
      } else {
        queue.push(frame);
      }
    }
  };

  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!headersDone) {
      const idx = buffer.indexOf("\r\n\r\n");
      if (idx === -1) return;
      buffer = buffer.subarray(idx + 4);
      headersDone = true;
    }
    drain();
  });
  socket.on("error", () => {
    if (waiter) waiter({ type: "error" });
  });

  const readFrame = (): Promise<any> => {
    if (queue.length) return Promise.resolve(queue.shift());
    return new Promise((resolve) => {
      waiter = resolve;
    });
  };
  // Tunggu headers selesai sebelum snapshot pertama.
  while (!headersDone) await new Promise((r) => setTimeout(r, 5));
  return { socket, readFrame };
}
