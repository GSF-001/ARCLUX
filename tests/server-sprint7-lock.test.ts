// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// server-sprint7-lock.test.ts — Sprint 7 PR-A (09-combat-depth §2.6):
// lock-on & targeting server-authoritative — 9 regresi wajib.

import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { WorldRegion } from "../mmo/packages/gameserver/world";
import { SimulationEngine } from "../mmo/packages/gameserver/simulation";
import {
  createLockStore,
  lockNeedFor,
  lockRangeOf,
  LOCK_BREAK_GRACE_TICKS,
  LOCK_RELOCK_WINDOW_TICKS,
} from "../mmo/packages/gameserver/targeting";
import { validateIntent, type AuthorityDeps } from "../mmo/packages/gameserver/validator";
import { createSessionStore } from "../mmo/packages/gameserver/session";
import { createInMemoryPersistence } from "../mmo/packages/gameserver/persistence";
import { createWantedStore } from "../mmo/packages/wanted";
import { createEconomy } from "../mmo/packages/economy";
import { createHackStore } from "../mmo/packages/gameserver/hack";
import { createClaimStore } from "../mmo/packages/gameserver/claims";
import { makeTestVesselModel as makeVesselModel } from "./helpers/vesselFixture";
import type { PlayerIntent, VesselEntity } from "../mmo/packages/gameserver/types";
import type { ValidatorContext } from "../mmo/packages/gameserver/validator";

function makeAuthority(): AuthorityDeps {
  return {
    sessions: createSessionStore(),
    wanted: createWantedStore(),
    economy: createEconomy(),
    hacks: createHackStore(),
    claims: createClaimStore(),
    locks: createLockStore(),
  };
}

const authProvider = (playerId: string): ValidatorContext => ({
  playerId,
  auth: { actor: playerId } as never,
});

interface Fixture {
  region: WorldRegion;
  engine: SimulationEngine;
  authority: AuthorityDeps;
  attacker: VesselEntity;
  target: VesselEntity;
  step(n?: number): void;
  enqueue(intent: PlayerIntent): void;
  /** Semua event (intent + lock events + combat) — sama dengan replay foundation. */
  events(): ReturnType<SimulationEngine["replayLog"]>;
}

/** Dunia kecil: p1 lock p2 — korvet (integrity 40 → need kecil & cepat). */
function fixture(opts?: { targetZ?: number; targetIntegrity?: number }): Fixture {
  const region = new WorldRegion("t7-lock", "Lock Test");
  const av = makeVesselModel("atk");
  av.integrity = 40;
  const attacker = region.spawnVessel({ id: "atk", owner: "p1", vessel: av, position: { x: 0, y: 0, z: 0 } });
  const tv = makeVesselModel("tgt");
  tv.integrity = opts?.targetIntegrity ?? 40;
  const target = region.spawnVessel({
    id: "tgt", owner: "p2", vessel: tv,
    position: { x: 0, y: 0, z: opts?.targetZ ?? 1000 },
  });
  const authority = makeAuthority();
  const engine = new SimulationEngine({ region, authProvider, authority });
  return {
    region, engine, authority, attacker, target,
    enqueue: (intent) => engine.enqueue(intent),
    step: (n = 1) => { for (let i = 0; i < n; i++) engine.step(); },
    events: () => engine.replayLog(),
  };
}

const lockIntent = (targetId: string, seq = 1): PlayerIntent => ({
  playerId: "p1", entityId: "atk", type: "lock", payload: { targetId }, seq,
});

describe("Sprint 7 PR-A lock-on (09 §2.6)", () => {
  it("1. in-cone dalam range → progress naik → lock_acquired pada tick ke-need", () => {
    const f = fixture();
    const need = lockNeedFor(f.target);
    expect(need).toBeGreaterThanOrEqual(1);
    f.enqueue(lockIntent("tgt"));
    f.step(need + 2);
    const acquired = f.events().find((e) => e.type === "lock_acquired");
    expect(acquired).toBeTruthy();
    expect(acquired?.payload.need).toBe(need);
    const cur = f.authority.locks?.current("atk");
    expect(cur?.phase).toBe("locked");
    // acquired tepat saat progress menyentuh need (progres 1/tick dari apply).
    expect(acquired?.tick).toBe(need - 1);
  });

  it("2. keluar cone > grace → lock_broken(out_of_cone); kembali < grace → recover", () => {
    const f = fixture();
    f.enqueue(lockIntent("tgt"));
    f.step(3); // acquiring, progress 3
    expect(f.authority.locks?.current("atk")?.phase).toBe("acquiring");

    // Cone fail selama 2 tick (< grace 4) → masih breaking, lalu recover.
    f.target.position = { x: 5000, y: 0, z: 0 };
    f.step(2);
    expect(f.authority.locks?.current("atk")?.phase).toBe("breaking");
    f.target.position = { x: 0, y: 0, z: 1000 };
    f.step(1);
    const back = f.authority.locks?.current("atk");
    expect(back?.phase).toBe("acquiring"); // recover dalam grace
    // Progress DITAHAN saat breaking (3), tick recover +1 — yang penting
    // tidak reset ke 0 (reset = re-lock penuh, cuma buat ganti target).
    expect(back?.progress).toBe(4);

    // Cone fail > grace → putus.
    f.target.position = { x: 5000, y: 0, z: 0 };
    f.step(LOCK_BREAK_GRACE_TICKS);
    expect(f.authority.locks?.current("atk")).toBeUndefined();
    const broken = f.events().find((e) => e.type === "lock_broken");
    expect(broken?.payload.reason).toBe("out_of_cone");
  });

  it("3. missile tanpa lock → rejected(lock_required); turret tanpa lock → accepted", () => {
    const f = fixture({ targetZ: 1000 });
    const ctx: ValidatorContext = { playerId: "p1", auth: { actor: "p1" } as never, authority: f.authority };
    const missile: PlayerIntent = {
      playerId: "p1", entityId: "atk", type: "attack",
      payload: { targetId: "tgt", weapon: "weapon.missile" }, seq: 1,
    };
    expect(validateIntent(f.region, missile, ctx)).toEqual({ decision: "reject", reason: "lock_required" });

    const turret: PlayerIntent = { ...missile, payload: { targetId: "tgt", weapon: "weapon.plasma" } };
    expect(validateIntent(f.region, turret, ctx).decision).toBe("accept");

    // Setelah locked → missile diterima.
    f.enqueue(lockIntent("tgt"));
    f.step(lockNeedFor(f.target));
    expect(f.authority.locks?.current("atk")?.phase).toBe("locked");
    expect(validateIntent(f.region, missile, ctx).decision).toBe("accept");
  });

  it("4. re-lock target sama < 100 tick setelah putus → progress start ≥ 50% need", () => {
    const f = fixture();
    const need = lockNeedFor(f.target);
    f.enqueue(lockIntent("tgt"));
    f.step(3);
    // Putus via cone out (grace habis) → recentBreak tersimpan.
    f.target.position = { x: 5000, y: 0, z: 0 };
    f.step(LOCK_BREAK_GRACE_TICKS);
    expect(f.authority.locks?.current("atk")).toBeUndefined();
    f.target.position = { x: 0, y: 0, z: 1000 };

    f.enqueue(lockIntent("tgt", 2));
    f.step(1);
    const cur = f.authority.locks?.current("atk");
    expect(cur).toBeTruthy();
    expect(cur!.progress).toBeGreaterThanOrEqual(Math.floor(need * 0.5));
    expect(LOCK_RELOCK_WINDOW_TICKS).toBe(100);
  });

  it("5. lock target KEDUA → slot baru (multilock 11.2 M1) — slot lama utuh", () => {
    const f = fixture();
    const tv = makeVesselModel("tgt2");
    tv.integrity = 40;
    f.region.spawnVessel({ id: "tgt2", owner: "p3", vessel: tv, position: { x: 0, y: 0, z: 1500 } });
    f.enqueue(lockIntent("tgt"));
    f.step(3);
    expect(f.authority.locks?.current("atk")?.progress).toBe(3);

    f.enqueue(lockIntent("tgt2", 2));
    f.step(1);
    // Slot 0 (tgt) tetap; tgt2 = slot 1 dengan progress sendiri.
    expect(f.authority.locks?.locksOf("atk").map((l) => l.targetId)).toEqual(["tgt", "tgt2"]);
    expect(f.authority.locks?.lockOn("atk", "tgt2")?.progress).toBe(1); // +1 stepLocks tick sama
    expect(f.authority.locks?.lockOn("atk", "tgt")?.progress).toBe(4); // tak terganggu
  });

  it("6. target di safe-zone lain → safety_boundary break", () => {
    const region = new WorldRegion("t7-sz", "SZ");
    const av = makeVesselModel("atk");
    av.integrity = 40;
    const attacker = region.spawnVessel({ id: "atk", owner: "p1", vessel: av, position: { x: 0, y: 0, z: -4000 } });
    const tv = makeVesselModel("tgt");
    tv.integrity = 40;
    region.spawnVessel({ id: "tgt", owner: "p2", vessel: tv, position: { x: 0, y: 0, z: 0 } });
    region.spawnStation({ id: "st1", name: "Safe", owner: "gov", position: { x: 0, y: 0, z: 0 }, safeZoneRadius: 1000 });
    const authority = makeAuthority();
    const engine = new SimulationEngine({ region, authProvider, authority });
    engine.enqueue(lockIntent("tgt"));
    for (let i = 0; i < LOCK_BREAK_GRACE_TICKS + 2; i++) engine.step();
    expect(authority.locks?.current("atk")).toBeUndefined();
    void attacker;
  });

  it("7. target destroyed saat acquiring → target_destroyed, store bersih", () => {
    const f = fixture();
    f.enqueue(lockIntent("tgt"));
    f.step(2);
    expect(f.authority.locks?.current("atk")).toBeTruthy();
    for (const s of f.target.vessel.systems) s.health = 0; // hull 0 = hancur
    f.step(1);
    expect(f.authority.locks?.current("atk")).toBeUndefined();
    const broken = f.events().find((e) => e.type === "lock_broken");
    expect(broken?.payload.reason).toBe("target_destroyed");
  });

  it("8. mode switch ship→fps saat locked → lock putus (mode_switch)", () => {
    const f = fixture();
    f.enqueue(lockIntent("tgt"));
    f.step(lockNeedFor(f.target));
    expect(f.authority.locks?.current("atk")?.phase).toBe("locked");
    f.authority.sessions.setMode("p2", "fps"); // target keluar cockpit
    f.step(LOCK_BREAK_GRACE_TICKS);
    expect(f.authority.locks?.current("atk")).toBeUndefined();
    const broken = f.events().filter((e) => e.type === "lock_broken").pop();
    expect(broken?.payload.reason).toBe("mode_switch");
  });

  it("9. determinisme: 2 proses child → progress identik tick per tick", async () => {
    const worker = join(dirname(fileURLToPath(import.meta.url)), "helpers", "lock-progress-worker.ts");
    const tsxBin = join(process.cwd(), "node_modules", ".bin", "tsx");
    const run = (): Promise<Array<{ tick: number; progress: number; phase: string }>> =>
      new Promise((resolve, reject) => {
        const child = spawn(tsxBin, [worker], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => { out += String(d); });
        child.stderr.on("data", (d) => { err += String(d); });
        child.on("close", (code) => {
          if (code !== 0) return reject(new Error(`worker exit ${code}: ${err.slice(0, 400)}`));
          try { resolve(JSON.parse(out.trim().split("\n").pop()!)); }
          catch (e) { reject(new Error(`bad worker output: ${out.slice(0, 300)} (${e})`)); }
        });
      });
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
    // Progres benar-benar maju (bukan dua-duanya mandek di 0).
    expect(a.some((r) => r.progress > 0)).toBe(true);
    // Range lock terpakai (memastikan fixture lolos syarat jarak).
    expect(lockRangeOf(fixture().attacker)).toBeGreaterThanOrEqual(8000);
  }, 60_000);
});
