// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// server-sprint6-load-verify.test.ts — Sprint 6 (08 §4):
// (1) public test-region: pemisahan test vs live (environment, default
//     regionId, tag directory, filter /servers, persistence key terpisah);
// load-test harness + determinism certificate punya file sendiri:
// tests/loadtest-harness.test.ts, tests/determinism-certificate.test.ts.

import { describe, it, expect, afterEach } from "vitest";
import { createGameServer } from "../mmo/packages/gameserver/server";
import type { GameServerHandle } from "../mmo/packages/gameserver/server";
import { getServer, listServers, unregisterServer } from "../mmo/packages/directory/registry";
import { createInMemoryPersistence } from "../mmo/packages/gameserver/persistence";
import type { RegionSnapshot } from "../mmo/packages/gameserver/types";

const started: GameServerHandle[] = [];
async function start(opts: Record<string, unknown>): Promise<{ gs: GameServerHandle; url: string }> {
  const gs = createGameServer({ port: 0, register: false, auth: false, ws: false, ...opts } as Parameters<typeof createGameServer>[0]);
  const { url } = await gs.start();
  started.push(gs);
  return { gs, url };
}

afterEach(async () => {
  while (started.length) {
    const gs = started.pop();
    try { await gs?.stop(); } catch { /* server sudah berhenti */ }
  }
  delete process.env.ARCLUX_GAME_ENV;
});

describe("Sprint 6 public test-region — pemisahan test vs live", () => {
  it("environment=test → default regionId test-region-1, /health bertag test", async () => {
    const { gs, url } = await start({ environment: "test" });
    expect(gs.region.regionId).toBe("test-region-1");
    const health = await fetch(`${url}/health`).then((r) => r.json());
    expect(health.environment).toBe("test");
    expect(health.regionId).toBe("test-region-1");
  }, 15_000);

  it("default (live) → region-1, /health environment live", async () => {
    const { gs, url } = await start({});
    expect(gs.region.regionId).toBe("region-1");
    const health = await fetch(`${url}/health`).then((r) => r.json());
    expect(health.environment).toBe("live");
  }, 15_000);

  it("fallback env ARCLUX_GAME_ENV=test saat option tidak di-set", async () => {
    process.env.ARCLUX_GAME_ENV = "test";
    const { gs } = await start({});
    expect(gs.region.regionId).toBe("test-region-1");
    delete process.env.ARCLUX_GAME_ENV;
  }, 15_000);

  it("regionId eksplisit menang atas default environment", async () => {
    const { gs } = await start({ environment: "test", regionId: "sisi-q-custom" });
    expect(gs.region.regionId).toBe("sisi-q-custom");
  }, 15_000);

  it("register → manifest directory bertag environment=test + filter environment", async () => {
    const regionId = `t6-reg-${process.pid}`;
    const { gs, url } = await start({ environment: "test", regionId, register: true });
    // Manifest ke-directory bawa environment.
    expect(getServer(regionId).manifest?.environment).toBe("test");
    // listServers filter live menyembunyikan shard test.
    expect(listServers({ environment: "live" }).some((s) => s.serverId === regionId)).toBe(false);
    expect(listServers({ environment: "test" }).some((s) => s.serverId === regionId)).toBe(true);
    // Filter via HTTP /servers.
    const testList = await fetch(`${url}/servers?environment=test`).then((r) => r.json());
    expect(testList.servers.some((s: { serverId: string }) => s.serverId === regionId)).toBe(true);
    const liveList = await fetch(`${url}/servers?environment=live`).then((r) => r.json());
    expect(liveList.servers.some((s: { serverId: string }) => s.serverId === regionId)).toBe(false);
    unregisterServer(regionId);
    void gs;
  }, 15_000);

  it("persistence key terpisah: simpan di test-region-1 tidak menyentuh region-1", async () => {
    const store = createInMemoryPersistence();
    const mk = (regionId: string, tick: number): RegionSnapshot => ({
      regionId, name: regionId, tick, createdAt: new Date(0).toISOString(), entities: [],
    });
    await store.saveRegion("t6-test-region", mk("t6-test-region", 42));
    await store.saveRegion("t6-live-region", mk("t6-live-region", 999));
    expect((await store.loadRegion("t6-test-region"))?.tick).toBe(42);
    expect((await store.loadRegion("t6-live-region"))?.tick).toBe(999);
    await store.deleteRegion("t6-test-region");
    expect(await store.loadRegion("t6-test-region")).toBeNull();
    expect((await store.loadRegion("t6-live-region"))?.tick).toBe(999);
  });
});
