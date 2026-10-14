// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Fase 3 PR-J — snapshot `tactical` projection (09-addendum M8/M9).

import { afterEach, describe, expect, it } from "vitest";
import { createGameServer, type GameServerHandle } from "../mmo/packages/gameserver/server";
import { makeTestVesselModel } from "./helpers/vesselFixture";
import { startLock, applyLockNeed, lockNeedFor } from "../mmo/packages/gameserver/targeting";
import { createWaveStore } from "../mmo/packages/gameserver/npcBrain";

const servers: GameServerHandle[] = [];
afterEach(async () => {
  while (servers.length) await servers.pop()!.stop();
});

describe("Fase 3 PR-J — snapshot tactical (M8/M9)", () => {
  it("1. locks PRIVATE: viewer p1 melihat lock-nya; p2 tidak", async () => {
    const gs = createGameServer({ regionId: "r-tactical", port: 0, register: false });
    servers.push(gs);
    const { url } = await gs.start();
    const v1 = gs.spawnPlayerVessel({ playerId: "p1", vessel: makeTestVesselModel("v1", 40), position: { x: 0, y: 0, z: 0 } });
    gs.spawnPlayerVessel({ playerId: "p2", vessel: makeTestVesselModel("v2", 40), position: { x: 0, y: 0, z: 500 } });

    const store = gs.authority.locks!;
    const res = startLock(store, v1, "v2", gs.region.tick);
    expect(res.started).toBe(true);
    applyLockNeed(store, v1.id, lockNeedFor(gs.region.getVessel("v2")!), "v2");

    const forP1 = await fetch(`${url}/snapshot?playerId=p1`).then((r) => r.json());
    expect(forP1.tactical).toBeTruthy();
    expect(forP1.tactical.locks).toHaveLength(1);
    expect(forP1.tactical.locks[0].targetId).toBe("v2");

    const forP2 = await fetch(`${url}/snapshot?playerId=p2`).then((r) => r.json());
    expect(forP2.tactical.locks).toHaveLength(0); // lock milik p1 tak bocor
  });

  it("2. wave + wrecks publik di tactical; anonim tanpa tactical", async () => {
    const gs = createGameServer({ regionId: "r-tactical2", port: 0, register: false });
    servers.push(gs);
    const { url } = await gs.start();
    gs.spawnPlayerVessel({ playerId: "p1", vessel: makeTestVesselModel("v1", 40) });

    // Inject wave state + wreck.
    gs.authority.waves!.state = {
      ...createWaveStore().state,
      phase: "in_progress", wave: 2, total: 5, spawned: 5,
    };
    gs.region.spawnWreck({ id: "wreck:npc-x", ownerId: "npc-x", position: { x: 10, y: 0, z: 10 }, contentsCredits: 80, tick: gs.region.tick });

    const snap = await fetch(`${url}/snapshot?playerId=p1`).then((r) => r.json());
    expect(snap.tactical.wave).toMatchObject({ wave: 2, phase: "in_progress", total: 5, spawned: 5 });
    expect(snap.tactical.wrecks.map((w: { id: string }) => w.id)).toContain("wreck:npc-x");

    const anon = await fetch(`${url}/snapshot`).then((r) => r.json());
    expect(anon.tactical).toBeUndefined(); // legacy tanpa viewer
  });
});
