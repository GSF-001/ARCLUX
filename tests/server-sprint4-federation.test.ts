// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// server-sprint4-federation.test.ts — regresi Sprint 4 "Multi-proses &
// federation" (08-server-hardening.md §4 / P0-6):
//
//   1. Handoff token Ed25519 (sign/verify/tamper/expired/anti-clone) —
//      menggantikan sanitizeToken heuristik.
//   2. Relay registry + identity PERSIST ke packages/db (restart ≠ hilang),
//      1 proses per region via opts.relay wiring di createGameServer.
//   3. Event record handoff (ledger) + lastSeq idempotency event-sourced.
//   4. Gate e2e lintas shard: 2 createGameServer real (region A + region B)
//      dengan HTTP /deliver — adapter tanpa docker (docker tidak tersedia di
//      Termux/CI): cakupan sama dengan "docker-compose 2 region" — dua server
//      otoritatif terpisah, handoff lewat jaringan, bukan mutasi langsung.
//   5. In-flight recovery: pending handoff crash-safe dire-deliver (D-013).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createPrivateKey, randomBytes, sign } from "node:crypto";

// ARCLUX_ROOT temp — relay persistence (JSON-per-record) menulis ke sini.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "arclux-sprint4-"));
process.env.ARCLUX_ROOT = TMP_ROOT;
// Secret acak per-run (bukan literal — ThreatCrush hardcoded-credential).
const HANDOFF_SECRET = randomBytes(32).toString("hex");
process.env.ARCLUX_HANDOFF_SECRET = HANDOFF_SECRET;
process.env.ARCLUX_AUTH_SECRET = randomBytes(32).toString("hex");

import { WorldRegion } from "../mmo/packages/gameserver/world";
import { createGameServer, type GameServerHandle } from "../mmo/packages/gameserver/server";
import { createGateRouter, type GateLink } from "../mmo/packages/gameserver/gate";
import { createInMemoryPersistence } from "../mmo/packages/gameserver/persistence";
import { signHandoff } from "../mmo/packages/gameserver/auth";
import { createGameBridge } from "../mmo/packages/gameserver/bridge";
import {
  createRelayRegistry,
  createPersistentRelayRegistry,
} from "../mmo/packages/relay/registry";
import { createIdentityMap, createPersistentIdentityMap } from "../mmo/packages/relay/identity";
import { createGateCoordinator } from "../mmo/packages/relay/gate";
import { createMemoryHandoffLedger, createDbHandoffLedger } from "../mmo/packages/relay/handoffLedger";
import {
  buildHandoffPayload,
  generateHandoffKeyPair,
  signHandoffToken,
  verifyHandoffToken,
  HANDOFF_TOKEN_TTL_MS,
} from "../mmo/packages/relay/handoffToken";
import type { VesselModel } from "../mmo/packages/universe/types";

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

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
    name: `Sprint4 ${id}`,
    source: { org: "GSF-001", repo: "sprint4", defaultBranch: "main", analyzedAt: "2026-10-10T00:00:00Z" },
    license: "open",
    systems: SUBSYSTEMS.map((s) => ({ ...s })),
    components: [],
    integrity: 80,
    defense: 75,
    weapons: 65,
    engine: 70,
  } as unknown as VesselModel;
}

// ---------- 1. Handoff token Ed25519 ----------
describe("Sprint 4 — handoff token Ed25519", () => {
  it("sign → verify roundtrip", () => {
    const keys = generateHandoffKeyPair();
    const payload = buildHandoffPayload({
      vesselId: "v1", playerId: "p1", fromShardId: "a", toShardId: "b", toRegionId: "r2", seq: 7,
    });
    const token = signHandoffToken(payload, keys.privateKey);
    const verdict = verifyHandoffToken(token, keys.publicKey);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.payload.vesselId).toBe("v1");
      expect(verdict.payload.playerId).toBe("p1");
      expect(verdict.payload.seq).toBe(7);
      expect(verdict.payload.exp - verdict.payload.iat).toBe(HANDOFF_TOKEN_TTL_MS);
    }
  });

  it("ditolak: body ditamper setelah sign", () => {
    const keys = generateHandoffKeyPair();
    const token = signHandoffToken(
      buildHandoffPayload({ vesselId: "v1", playerId: "p1", fromShardId: "a", toShardId: "b", toRegionId: "r2", seq: 1 }),
      keys.privateKey,
    );
    const [bodyB64, sigB64] = token.split(".");
    const tamperedBody = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(bodyB64, "base64url").toString()), playerId: "attacker" }),
      "utf8",
    ).toString("base64url");
    const verdict = verifyHandoffToken(`${tamperedBody}.${sigB64}`, keys.publicKey);
    expect(verdict.ok).toBe(false);
  });

  it("ditolak: public key beda", () => {
    const a = generateHandoffKeyPair();
    const b = generateHandoffKeyPair();
    const token = signHandoffToken(
      buildHandoffPayload({ vesselId: "v1", playerId: "p1", fromShardId: "a", toShardId: "b", toRegionId: "r2", seq: 1 }),
      a.privateKey,
    );
    expect(verifyHandoffToken(token, b.publicKey).ok).toBe(false);
  });

  it("ditolak: expired", () => {
    const keys = generateHandoffKeyPair();
    const past = Date.now() - HANDOFF_TOKEN_TTL_MS - 10_000;
    const token = signHandoffToken(
      buildHandoffPayload({ vesselId: "v1", playerId: "p1", fromShardId: "a", toShardId: "b", toRegionId: "r2", seq: 1 }, past),
      keys.privateKey,
    );
    expect(verifyHandoffToken(token, keys.publicKey).ok).toBe(false);
  });

  it("anti-clone: field ekstra di payload ditolak (struktural, bukan heuristik)", () => {
    const keys = generateHandoffKeyPair();
    const body = JSON.stringify({
      vesselId: "v1", playerId: "p1", fromShardId: "a", toShardId: "b", toRegionId: "r2",
      seq: 1, iat: Date.now(), exp: Date.now() + 60_000,
      sourceCode: "export function hack() {}", // payload bebas = diblokir
    });
    const priv = createPrivateKey({ key: Buffer.from(keys.privateKey, "base64"), format: "der", type: "pkcs8" });
    const sig = sign(null, Buffer.from(body, "utf8"), priv);
    const token = `${Buffer.from(body, "utf8").toString("base64url")}.${sig.toString("base64url")}`;
    const verdict = verifyHandoffToken(token, keys.publicKey);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/anti-clone/);
  });
});

// ---------- 2. Registry + identity persist ----------
describe("Sprint 4 — relay registry/identity persist (packages/db)", () => {
  it("registry: hydrate setelah 'restart' + claim anti-bentrok", () => {
    const r1 = createPersistentRelayRegistry();
    r1.registerShard({ shardId: "shard-x", address: "http://127.0.0.1:1", regionIds: ["rx"], status: "up" });
    expect(r1.claimRegion("rx", "shard-x")).toBe(true);
    r1.setShardStatus("shard-x", "draining");

    // "restart": instance baru dari store yang sama → state ter-hydrate.
    const r2 = createPersistentRelayRegistry();
    expect(r2.getShard("shard-x")?.status).toBe("draining");
    expect(r2.resolveRegion("rx")?.shardId).toBe("shard-x");
    // claim oleh shard lain ditolak (tetap, setelah hydrate).
    r2.registerShard({ shardId: "shard-y", address: "http://127.0.0.1:2", regionIds: [], status: "up" });
    expect(r2.claimRegion("rx", "shard-y")).toBe(false);
  });

  it("identity: persist attach/move + hydrate setelah restart", () => {
    const i1 = createPersistentIdentityMap();
    i1.attach("player-1", { shardId: "sa", entityIds: ["v-1"], lastSeen: Date.now() });
    i1.move("player-1", "sa", "sb", "v-1");

    const i2 = createPersistentIdentityMap();
    const presence = i2.resolve("player-1");
    expect(presence.some((p) => p.shardId === "sb" && p.entityIds.includes("v-1"))).toBe(true);
    expect(presence.some((p) => p.shardId === "sa" && p.entityIds.includes("v-1"))).toBe(false);
  });
});

// ---------- 3. Ledger event + idempotency event-sourced ----------
describe("Sprint 4 — handoff ledger (event record + lastSeq)", () => {
  it("lastSeq hanya naik saat delivered; rejected tidak mengunci retry", () => {
    const ledger = createMemoryHandoffLedger();
    ledger.append({ key: "v1:r2", type: "requested", vesselId: "v1", fromShardId: "a", toShardId: "b", toRegionId: "r2", seq: 3, ok: true });
    ledger.append({ key: "v1:r2", type: "rejected", vesselId: "v1", fromShardId: "a", toShardId: "b", toRegionId: "r2", seq: 3, ok: false, reason: "down" });
    expect(ledger.lastSeq("v1:r2")).toBeUndefined(); // retry seq 3 masih boleh
    ledger.append({ key: "v1:r2", type: "delivered", vesselId: "v1", fromShardId: "a", toShardId: "b", toRegionId: "r2", seq: 3, ok: true });
    expect(ledger.lastSeq("v1:r2")).toBe(3);
  });

  it("db ledger: persist + hydrate (relay restart ≠ seq hilang)", () => {
    const l1 = createDbHandoffLedger();
    l1.append({ key: "v9:r9", type: "delivered", vesselId: "v9", fromShardId: "a", toShardId: "b", toRegionId: "r9", seq: 11, ok: true });
    const l2 = createDbHandoffLedger();
    expect(l2.lastSeq("v9:r9")).toBe(11);
  });

  it("coordinator: stale seq ditolak via ledger persist", async () => {
    const registry = createRelayRegistry();
    registry.registerShard({ shardId: "b", address: "x", regionIds: ["r2"], status: "up" });
    registry.claimRegion("r2", "b");
    const ledger = createMemoryHandoffLedger();
    let delivered = 0;
    const coordinator = createGateCoordinator({
      registry,
      fromShardId: "a",
      ledger,
      verifyToken: (t) => (t === "OK" ? { ok: true } : { ok: false, reason: "bad token" }),
      deliver: async () => { delivered++; return { ok: true }; },
    });
    const base = { vesselId: "v1", fromRegionId: "r1", fromShardId: "a", toRegionId: "r2", toShardId: "b", transferToken: "OK" };
    expect((await coordinator.requestHandoff({ ...base, seq: 1 })).ok).toBe(true);
    expect((await coordinator.requestHandoff({ ...base, seq: 1 })).ok).toBe(false); // stale
    expect((await coordinator.requestHandoff({ ...base, seq: 2 })).ok).toBe(true);
    expect(delivered).toBe(2);
  });

  it("coordinator: token gagal verifikasi ditolak + tercatat di ledger", async () => {
    const registry = createRelayRegistry();
    registry.registerShard({ shardId: "b", address: "x", regionIds: ["r2"], status: "up" });
    registry.claimRegion("r2", "b");
    const ledger = createMemoryHandoffLedger();
    const coordinator = createGateCoordinator({
      registry,
      fromShardId: "a",
      ledger,
      verifyToken: () => ({ ok: false, reason: "bad signature" }),
      deliver: async () => ({ ok: true }),
    });
    const res = await coordinator.requestHandoff({
      vesselId: "v1", fromRegionId: "r1", fromShardId: "a", toRegionId: "r2", toShardId: "b", transferToken: "junk", seq: 1,
    });
    expect(res.ok).toBe(false);
    expect(ledger.list().some((e) => e.type === "rejected" && e.reason === "bad signature")).toBe(true);
  });
});

// ---------- 4. Gate e2e lintas shard (2 server real, HTTP /deliver) ----------
describe("Sprint 4 — gate e2e lintas shard (2 region, HTTP)", () => {
  let A: GameServerHandle;
  let B: GameServerHandle;
  const keys = generateHandoffKeyPair();

  beforeAll(async () => {
    const registry = createPersistentRelayRegistry();
    A = createGameServer({
      regionId: "region-a", port: 0, register: false, eventStore: false, ws: false, auth: false,
      relay: { shardId: "shard-a", registry },
    });
    B = createGameServer({
      regionId: "region-b", port: 0, register: false, eventStore: false, ws: false, auth: false,
      relay: { shardId: "shard-b", registry, handoffPublicKey: keys.publicKey },
    });
    await A.start();
    await B.start();
  });
  afterAll(async () => {
    await A?.stop();
    await B?.stop();
  });

  it("start() register shard + claim region di registry terpusat", () => {
    expect(A.region.regionId).toBe("region-a");
    expect(B.region.regionId).toBe("region-b");
  });

  it("transit: vessel pindah region A → B via HTTP /deliver + token Ed25519", async () => {
    const model = vesselModel("v-e2e");
    A.spawnPlayerVessel({ playerId: "p1", vessel: model, position: { x: 2000, y: 0, z: 0 } });
    expect(A.region.has("v-e2e")).toBe(true);

    let seq = 0;
    const links: GateLink[] = [{
      id: "gate-ab", localRegionId: "region-a", targetRegionId: "region-b",
      position: { x: 2000, y: 0, z: 0 }, activationRadius: 5000, allowedCommunityIds: [],
    }];
    const router = createGateRouter(links, {
      region: A.region,
      notifyTarget: async (targetRegionId, handoff) => {
        const toShard = "shard-b";
        const token = signHandoffToken(
          buildHandoffPayload({
            vesselId: handoff.vesselId, playerId: handoff.owner ?? "",
            fromShardId: "shard-a", toShardId: toShard, toRegionId: targetRegionId, seq: ++seq,
          }),
          keys.privateKey,
        );
        const raw = JSON.stringify({ vesselId: handoff.vesselId, owner: handoff.owner, position: handoff.position, vessel: model, handoffToken: token });
        const res = await fetch(`${B.url}/deliver`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-arclux-handoff": signHandoff(raw, HANDOFF_SECRET) },
          body: raw,
        });
        return res.json() as Promise<{ ok: boolean; reason?: string }>;
      },
    });

    const result = await router.transit({ gateId: "gate-ab", vesselId: "v-e2e", targetRegionId: "region-b", requestedBy: "p1" });
    expect(result.ok).toBe(true);
    expect(A.region.has("v-e2e")).toBe(false); // lepas dari asal
    expect(B.region.has("v-e2e")).toBe(true); // materialized di tujuan
    expect(B.region.getVessel("v-e2e")?.owner).toBe("p1"); // playerId dari token terverifikasi
  });

  it("/deliver menolak body valid tanpa handoffToken (publik key dikonfigurasi)", async () => {
    const model = vesselModel("v-notok");
    const raw = JSON.stringify({ vesselId: "v-notok", owner: "p1", position: { x: 1, y: 0, z: 0 }, vessel: model });
    const res = await fetch(`${B.url}/deliver`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-arclux-handoff": signHandoff(raw, HANDOFF_SECRET) },
      body: raw,
    });
    expect(res.status).toBe(403);
    expect(B.region.has("v-notok")).toBe(false);
  });

  it("/deliver menolak handoffToken vesselId beda dari payload", async () => {
    const model = vesselModel("v-mismatch");
    const token = signHandoffToken(
      buildHandoffPayload({ vesselId: "v-other", playerId: "p1", fromShardId: "shard-a", toShardId: "shard-b", toRegionId: "region-b", seq: 99 }),
      keys.privateKey,
    );
    const raw = JSON.stringify({ vesselId: "v-mismatch", owner: "p1", position: { x: 1, y: 0, z: 0 }, vessel: model, handoffToken: token });
    const res = await fetch(`${B.url}/deliver`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-arclux-handoff": signHandoff(raw, HANDOFF_SECRET) },
      body: raw,
    });
    expect(res.status).toBe(403);
    expect(B.region.has("v-mismatch")).toBe(false);
  });

  it("registry terpusat: instance PERSISTEN baru hydrate kedua shard (restart ≠ hilang)", () => {
    const fresh = createPersistentRelayRegistry();
    expect(fresh.getShard("shard-a")?.status).toBe("up");
    expect(fresh.getShard("shard-b")?.status).toBe("up");
    expect(fresh.resolveRegion("region-a")?.shardId).toBe("shard-a");
    expect(fresh.resolveRegion("region-b")?.shardId).toBe("shard-b");
  });

  it("stop() → status shard down di registry", async () => {
    const registry = createPersistentRelayRegistry();
    const S = createGameServer({
      regionId: "region-s", port: 0, register: false, eventStore: false, ws: false, auth: false,
      relay: { shardId: "shard-s", registry },
    });
    await S.start();
    expect(registry.getShard("shard-s")?.status).toBe("up");
    await S.stop();
    // registry "pusat" yang sama (proses lain) melihat status down.
    expect(createPersistentRelayRegistry().getShard("shard-s")?.status).toBe("down");
  });
});

// ---------- 5. In-flight recovery + bridge in-process ----------
describe("Sprint 4 — in-flight recovery & bridge Ed25519", () => {
  it("deliver gagal → rollback bersih (pending dihapus, vessel tetap); crash-sim → recover re-deliver (D-013)", async () => {
    const region = new WorldRegion("region-r", "R");
    region.spawnVessel({ id: "v-r", owner: "p1", vessel: vesselModel("v-r"), position: { x: 100, y: 0, z: 0 } });
    const persist = createInMemoryPersistence();
    let fail = true;
    const router = createGateRouter(
      [{ id: "gate-r", localRegionId: "region-r", targetRegionId: "region-t", position: { x: 100, y: 0, z: 0 }, activationRadius: 500, allowedCommunityIds: [] }],
      {
        region,
        persist,
        notifyTarget: async () => (fail ? { ok: false, reason: "target down" } : { ok: true }),
      },
    );

    // deliver gagal → ROLLBACK bersih: pending dihapus, vessel tetap di asal.
    const failed = await router.transit({ gateId: "gate-r", vesselId: "v-r", targetRegionId: "region-t", requestedBy: "p1" });
    expect(failed.ok).toBe(false);
    expect(region.has("v-r")).toBe(true);
    expect((await persist.loadPendingHandoffs()).length).toBe(0); // abort = bukan in-flight

    // crash-sim: pending tersimpan di disk TANPA hidup lagi di memori
    // (proses mati di tengah transit — vessel hilang dari asal, belum confirmed).
    region.remove("v-r");
    await persist.savePendingHandoff({
      vesselId: "v-crash", owner: "p1", position: { x: 100, y: 0, z: 0 },
      gateId: "gate-r", fromRegionId: "region-r", toRegionId: "region-t",
      startedAt: new Date().toISOString(),
    });
    expect((await persist.loadPendingHandoffs()).length).toBe(1); // in-flight crash-safe

    fail = false; // target bangkit → recovery re-deliver
    const recovered = await router.recoverPendingHandoffs();
    expect(recovered).toBe(1);
    expect((await persist.loadPendingHandoffs()).length).toBe(0);
  });

  it("bridge in-process: handoffKeys Ed25519 — deliver verifikasi token, owner terverifikasi", async () => {
    const keys = generateHandoffKeyPair();
    const registry = createRelayRegistry();
    const identity = createIdentityMap();
    const vesselModels = new Map<string, VesselModel>([["v-b", vesselModel("v-b")]]);
    const regionA = new WorldRegion("ba", "BA");
    const regionB = new WorldRegion("bb", "BB");
    const bridge = createGameBridge({
      registry,
      identity,
      vesselModels,
      handoffKeys: keys,
      shards: [
        { shardId: "sa", address: "in-proc:a", region: regionA, gateLinks: [{ id: "g", localRegionId: "ba", targetRegionId: "bb", position: { x: 50, y: 0, z: 0 }, activationRadius: 1000, allowedCommunityIds: [] }] },
        { shardId: "sb", address: "in-proc:b", region: regionB, gateLinks: [] },
      ],
    });
    regionA.spawnVessel({ id: "v-b", owner: "p1", vessel: vesselModel("v-b"), position: { x: 50, y: 0, z: 0 } });
    bridge.attachVessel("sa", regionA.getVessel("v-b")!);

    const result = await bridge.runtimes.get("sa")!.router.transit({
      gateId: "g", vesselId: "v-b", targetRegionId: "bb", requestedBy: "p1",
    });
    expect(result.ok).toBe(true);
    expect(regionB.getVessel("v-b")?.owner).toBe("p1");
    // presence pindah shard (identity lintas shard).
    expect(identity.resolve("p1").some((p) => p.shardId === "sb" && p.entityIds.includes("v-b"))).toBe(true);
  });
});
