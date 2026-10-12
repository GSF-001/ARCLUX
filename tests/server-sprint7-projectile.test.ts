// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// server-sprint7-projectile.test.ts — Sprint 7 PR-B (09-combat-depth §3.6):
// projectile server-side (homing, arm, TTL, PD, cap) — 7 regresi wajib.

import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { WorldRegion } from "../mmo/packages/gameserver/world";
import { SimulationEngine } from "../mmo/packages/gameserver/simulation";
import {
  spawnProjectile,
  interceptProjectile,
  MAX_PROJECTILES_PER_REGION,
} from "../mmo/packages/gameserver/projectiles";
import { DAMAGE_CEILING } from "../mmo/packages/gameserver/combat";
import { createLockStore } from "../mmo/packages/gameserver/targeting";
import { createSessionStore } from "../mmo/packages/gameserver/session";
import { createWantedStore } from "../mmo/packages/wanted";
import { createEconomy } from "../mmo/packages/economy";
import { createHackStore } from "../mmo/packages/gameserver/hack";
import { createClaimStore } from "../mmo/packages/gameserver/claims";
import { makeTestVesselModel } from "./helpers/vesselFixture";
import { createSeedRng } from "../mmo/packages/gameserver/random";
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
  attacker: VesselEntity;
  target: VesselEntity;
  step(n?: number): void;
  enqueue(intent: PlayerIntent): void;
  events(): ReturnType<SimulationEngine["replayLog"]>;
  lockTo(phase: "locked", maxTicks?: number): void;
}

function fixture(opts?: { targetZ?: number }): Fixture {
  const region = new WorldRegion("t7-prj", "Projectile Test");
  const av = makeTestVesselModel("atk");
  av.integrity = 40;
  const attacker = region.spawnVessel({ id: "atk", owner: "p1", vessel: av, position: { x: 0, y: 0, z: 0 } });
  const tv = makeTestVesselModel("tgt");
  tv.integrity = 40;
  const target = region.spawnVessel({
    id: "tgt", owner: "p2", vessel: tv,
    position: { x: 0, y: 0, z: opts?.targetZ ?? 1000 },
  });
  const authority = makeAuthority();
  const engine = new SimulationEngine({ region, authProvider, authority });
  const f: Fixture = {
    region, engine, authority, attacker, target,
    enqueue: (intent) => engine.enqueue(intent),
    step: (n = 1) => { for (let i = 0; i < n; i++) engine.step(); },
    events: () => engine.replayLog(),
    lockTo: (phase, maxTicks = 40) => {
      engine.enqueue({ playerId: "p1", entityId: "atk", type: "lock", payload: { targetId: "tgt" }, seq: 0 });
      for (let i = 0; i < maxTicks; i++) {
        engine.step();
        if (authority.locks?.current("atk")?.phase === phase) return;
      }
      throw new Error(`lock never reached phase=${phase}`);
    },
  };
  return f;
}

const missileAttack = (seq: number, weapon = "weapon.missile"): PlayerIntent => ({
  playerId: "p1", entityId: "atk", type: "attack",
  payload: { targetId: "tgt", weapon }, seq,
});

describe("Sprint 7 PR-B projectile (09 §3.6)", () => {
  it("1. spawn via intent missile setelah lock → projectile_spawned, array 1", () => {
    const f = fixture();
    f.lockTo("locked");
    f.enqueue(missileAttack(1));
    f.step(1);
    const ev = f.events().find((e) => e.type === "projectile_spawned");
    expect(ev).toBeTruthy();
    expect(f.region.projectiles.length).toBe(1);
    expect(f.region.projectiles[0].weaponType).toBe("weapon.missile");
  });

  it("2. target diam → projectile_hit deterministik, damage ≤ ceiling, subsystem berkurang", () => {
    const f = fixture();
    f.lockTo("locked");
    const defHealth = () => f.target.vessel.systems.find((s) => s.id === "defense")!.health;
    const before = defHealth();
    f.enqueue(missileAttack(1));
    f.step(30);
    const hit = f.events().find((e) => e.type === "projectile_hit");
    expect(hit).toBeTruthy();
    expect(hit?.payload.damage).toBeLessThanOrEqual(DAMAGE_CEILING);
    expect(defHealth()).toBeLessThan(before);
    expect(f.region.projectiles.length).toBe(0); // meledak — hilang dari langit
  });

  it("3. target dodge zig-zag seeded → TTL habis tanpa hit → projectile_fizzle", () => {
    // Torpedo (turn 0.07, speed 35): capital hunter lambat — kapal zig-zag
    // transversal bisa dielak (inti §3.1 "bisa dielak").
    // Jarak 3000m + target speed penuh transversal: closing radial torpedo
    // ~sqrt(35²−25²)≈24.5 m/tick → butuh ~122 tick > TTL 80 → fizzle.
    const f = fixture({ targetZ: 3000 });
    f.lockTo("locked");
    const rng = createSeedRng(7);
    let seq = 1;
    // Warm-up: kapal dipercepat dulu sampai speed penuh (accel 0.4 m/tick²)
    // — zig-zag dari diam = net transversal nol (torpedo gampang kena).
    for (let i = 0; i < 55; i++) {
      f.enqueue({ playerId: "p2", entityId: "tgt", type: "move", payload: { x: 3000, y: 0, z: 3000 } as never, seq: seq++ });
      f.step(1);
    }
    f.enqueue(missileAttack(seq++, "weapon.torpedo"));
    let broke = false;
    for (let i = 0; i < 100; i++) {
      // Zig-zag deterministik (seed sama), period panjang (25 tick/sisi) —
      // kapal speed penuh transversal terus bolak-balik.
      const side = i % 50 < 25 ? 1 : -1;
      const amp = 3000 + rng.int(0, 200);
      f.enqueue({
        playerId: "p2", entityId: "tgt", type: "move",
        payload: { x: side * amp, y: 0, z: 3000 } as never, seq: seq++,
      });
      f.step(1);
      if (f.region.projectiles.length === 0) { broke = true; break; }
    }
    expect(broke).toBe(true);
    const fizzle = f.events().find((e) => e.type === "projectile_fizzle");
    const hit = f.events().find((e) => e.type === "projectile_hit");
    expect(hit).toBeUndefined();
    expect(fizzle).toBeTruthy();
  });

  it("4. intercept: dua seed menghasilkan dua hasil (destroyed vs selamat)", () => {
    const region = new WorldRegion("t7-pd", "PD");
    const av = makeTestVesselModel("shooter");
    const shooter = region.spawnVessel({ id: "shooter", owner: "p1", vessel: av, position: { x: 0, y: 0, z: 0 } });
    const tv = makeTestVesselModel("tgt");
    region.spawnVessel({ id: "tgt", owner: "p2", vessel: tv, position: { x: 0, y: 0, z: 1000 } });
    const results: boolean[] = [];
    for (let i = 0; i < 24; i++) {
      const prj = spawnProjectile(region, "shooter", "weapon.missile", "tgt", 100, i)!;
      prj.pos = { x: 0, y: 0, z: 50 + i }; // in-cone (depan), dalam range
      results.push(interceptProjectile(region, shooter, prj.id, 100));
      region.projectiles.length = 0;
    }
    expect(results.some((r) => r === true)).toBe(true);
    expect(results.some((r) => r === false)).toBe(true);
  });

  it("5. arm time: tembak point-blank TIDAK self-fizzle — kena saat homing kembali", () => {
    const f = fixture({ targetZ: 5 });
    f.lockTo("locked");
    f.enqueue(missileAttack(1));
    f.step(45);
    const hit = f.events().find((e) => e.type === "projectile_hit");
    expect(hit).toBeTruthy(); // tidak fizzle percuma di point-blank
    expect(f.events().find((e) => e.type === "projectile_fizzle")).toBeUndefined();
  });

  it("6. cap 100: spawn ke-101 → reject (undefined)", () => {
    const region = new WorldRegion("t7-cap", "Cap");
    const av = makeTestVesselModel("atk");
    region.spawnVessel({ id: "atk", owner: "p1", vessel: av, position: { x: 0, y: 0, z: 0 } });
    const tv = makeTestVesselModel("tgt");
    region.spawnVessel({ id: "tgt", owner: "p2", vessel: tv, position: { x: 0, y: 0, z: 1000 } });
    for (let i = 0; i < MAX_PROJECTILES_PER_REGION; i++) {
      const p = spawnProjectile(region, "atk", "weapon.missile", "tgt", 1, i);
      expect(p).toBeTruthy();
    }
    expect(region.projectiles.length).toBe(MAX_PROJECTILES_PER_REGION);
    expect(spawnProjectile(region, "atk", "weapon.missile", "tgt", 1, 9999)).toBeUndefined();
  });

  it("7. determinisme: 2 proses child → posisi projectile identik per tick", async () => {
    const worker = join(dirname(fileURLToPath(import.meta.url)), "helpers", "projectile-track-worker.ts");
    const tsxBin = join(process.cwd(), "node_modules", ".bin", "tsx");
    const run = (): Promise<Array<{ tick: number; n: number; head: string }>> =>
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
    expect(a.length).toBeGreaterThan(10);
    expect(b).toEqual(a);
    expect(a.some((r) => r.n > 0)).toBe(true);
  }, 60_000);
});
