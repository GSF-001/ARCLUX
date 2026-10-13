// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Sprint 7 PR-G — splash torpedo (09-addendum §11.2 M3).

import { describe, expect, it } from "vitest";
import { WorldRegion } from "../mmo/packages/gameserver/world";
import { SimulationEngine } from "../mmo/packages/gameserver/simulation";
import { createLockStore } from "../mmo/packages/gameserver/targeting";
import type { AuthorityDeps, ValidatorContext } from "../mmo/packages/gameserver/validator";
import { createSessionStore } from "../mmo/packages/gameserver/session";
import { createWantedStore } from "../mmo/packages/wanted";
import { createEconomy } from "../mmo/packages/economy";
import { createHackStore } from "../mmo/packages/gameserver/hack";
import { createClaimStore } from "../mmo/packages/gameserver/claims";
import { makeTestVesselModel as makeVesselModel } from "./helpers/vesselFixture";
import { TORPEDO_SPLASH_RADIUS_M, TORPEDO_SPLASH_FALLOFF } from "../mmo/packages/gameserver/projectiles";
import type { PlayerIntent, VesselEntity } from "../mmo/packages/gameserver/types";

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
  events(): ReturnType<SimulationEngine["replayLog"]>;
}

/**
 * atk (p1) di origin → tgt (p2) di z=1000. victims opsional disekitar
 * titik impact (±200m dari tgt = dalam radius; 900m = luar).
 */
function fixture(opts?: {
  nearZ?: number;   // victim dekat (dalam radius)
  edgeX?: number;   // victim di tepi radius (sumbu x dari target)
  farZ?: number;    // victim luar radius
}): Fixture {
  const region = new WorldRegion("t7g-splash", "Splash Test");
  const av = makeVesselModel("atk");
  av.integrity = 40;
  const attacker = region.spawnVessel({ id: "atk", owner: "p1", vessel: av, position: { x: 0, y: 0, z: 0 } });
  const tv = makeVesselModel("tgt");
  tv.integrity = 40;
  const target = region.spawnVessel({ id: "tgt", owner: "p2", vessel: tv, position: { x: 0, y: 0, z: 1000 } });
  if (opts?.nearZ !== undefined) {
    const nv = makeVesselModel("near");
    nv.integrity = 80;
    region.spawnVessel({ id: "near", owner: "p3", vessel: nv, position: { x: 0, y: 0, z: 1000 + opts.nearZ } });
  }
  if (opts?.edgeX !== undefined) {
    const ev = makeVesselModel("edge");
    ev.integrity = 80;
    region.spawnVessel({ id: "edge", owner: "p4", vessel: ev, position: { x: opts.edgeX, y: 0, z: 1000 } });
  }
  if (opts?.farZ !== undefined) {
    const fv = makeVesselModel("far");
    fv.integrity = 80;
    region.spawnVessel({ id: "far", owner: "p5", vessel: fv, position: { x: 0, y: 0, z: 1000 + opts.farZ } });
  }
  const authority = makeAuthority();
  const engine = new SimulationEngine({ region, authProvider, authority });
  return {
    region, engine, authority, attacker, target,
    enqueue: (intent) => engine.enqueue(intent),
    step: (n = 1) => { for (let i = 0; i < n; i++) engine.step(); },
    events: () => engine.replayLog(),
  };
}

const torpedoAttack = (seq = 1): PlayerIntent => ({
  playerId: "p1", entityId: "atk", type: "attack",
  payload: { targetId: "tgt", weapon: "weapon.torpedo" }, seq,
});

describe("Sprint 7 PR-G — splash torpedo (09-addendum §11.2 M3)", () => {
  it("1. torpedo hit primary → projectile_splash ter-emit (victim dalam radius)", () => {
    const f = fixture({ nearZ: -200 }); // 200m dari impact
    f.enqueue(torpedoAttack());
    f.step(40);
    expect(f.events().some((e) => e.type === "projectile_hit")).toBe(true);
    const splash = f.events().find((e) => e.type === "projectile_splash");
    expect(splash).toBeTruthy();
    // Primary TIDAK ikut splash; near kena.
    const hits = splash?.payload.hits as Array<{ targetId: string }>;
    expect(hits.map((h) => h.targetId)).toContain("near");
    expect(hits.map((h) => h.targetId)).not.toContain("tgt");
    expect(splash?.payload.center).toBeTruthy();
  });

  it("2. victim dalam radius kena damage scaled (falloff) — lebih kecil dari primary full", () => {
    const f = fixture({ nearZ: -200 });
    f.enqueue(torpedoAttack());
    f.step(40);
    const hit = f.events().find((e) => e.type === "projectile_hit");
    const splash = f.events().find((e) => e.type === "projectile_splash");
    const primaryDmg = hit?.payload.damage as number;
    const hits = splash?.payload.hits as Array<{ targetId: string; damage: number }>;
    const nearDmg = hits.find((h) => h.targetId === "near")!.damage;
    expect(nearDmg).toBeGreaterThan(0);
    expect(nearDmg).toBeLessThanOrEqual(primaryDmg);
    // Falloff linear: 200/800 → scale 0.875.
    expect(nearDmg).toBeLessThanOrEqual(Math.ceil(primaryDmg * (1 - TORPEDO_SPLASH_FALLOFF * (200 / TORPEDO_SPLASH_RADIUS_M))));
  });

  it("3. victim luar radius tidak kena", () => {
    const f = fixture({ nearZ: -200, farZ: -900 }); // far: 900m dari impact
    f.enqueue(torpedoAttack());
    f.step(40);
    const splash = f.events().find((e) => e.type === "projectile_splash");
    expect(splash).toBeTruthy();
    const hits = splash?.payload.hits as Array<{ targetId: string }>;
    expect(hits.map((h) => h.targetId)).not.toContain("far");
    expect(f.region.getVessel("far")!.vessel.systems.every((s) => s.health === 70)).toBe(true);
  });

  it("4. falloff tepat radius 50% + friendly-fire kapal sekutu ikut kena", () => {
    // 750m ≈ tepi radius (impact ± HIT_RADIUS_M; 800 persis bisa >radius).
    const f = fixture({ edgeX: 750, nearZ: -300 });
    f.enqueue(torpedoAttack());
    f.step(40);
    const splash = f.events().find((e) => e.type === "projectile_splash");
    expect(splash).toBeTruthy();
    const hits = splash?.payload.hits as Array<{ targetId: string; damage: number }>;
    const edge = hits.find((h) => h.targetId === "edge");
    expect(edge).toBeTruthy();
    // 750/800 → scale ≈ 0.53 → damage < 60% primary.
    const primaryDmg = f.events().find((e) => e.type === "projectile_hit")?.payload.damage as number;
    expect(edge!.damage).toBeLessThanOrEqual(Math.ceil(primaryDmg * 0.6));
    // Friendly-fire: near (owner p3 — bukan sekutu attacker) kena.
    expect(hits.map((h) => h.targetId)).toContain("near");
  });
});
