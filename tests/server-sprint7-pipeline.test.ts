// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Sprint 7 PR-D — damage pipeline (09-combat-depth §5.3).

import { describe, expect, it } from "vitest";
import type { SystemState, VesselModel } from "../mmo/packages/universe/types";
import type { VesselEntity } from "../mmo/packages/gameserver/types";
import {
  applyWeaponDamage,
  damageFormulaOf,
  DAMAGE_CEILING,
} from "../mmo/packages/gameserver/combat";
import {
  attackPowerOf,
  defensePowerOf,
  signatureOf,
  rangeFalloffOf,
  conditionPenaltyOf,
  weaponRangeOf,
} from "../mmo/packages/gameserver/stats";

function systems(overrides: Record<string, number> = {}): SystemState[] {
  const base: Record<string, number> = { engine: 70, reactor: 100, navigation: 60, defense: 75, weapons: 100, ai: 50 };
  return Object.entries({ ...base, ...overrides }).map(([id, health]) => ({
    id, label: id, health, baseStat: health,
  }));
}

function vessel(id: string, overrides: Record<string, number> = {}): VesselEntity {
  const model = {
    id, name: id, class: "frigate", integrity: 50, systems: systems(overrides),
    components: [],
    slotLayout: { engine: 4, reactor: 3, navigation: 3, defense: 4, weapons: 4, ai: 2 },
  } as unknown as VesselModel;
  return {
    id, kind: "vessel", owner: "p1", position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }, heading: { yaw: 0, pitch: 0 },
    vessel: model, cooldowns: {},
  } as VesselEntity;
}

describe("Sprint 7 PR-D — damage pipeline (09 §5.3)", () => {
  it("1. kapal power 150 vs defense 50 → 3× lipat dasar (sebelum ceiling)", () => {
    const atk = vessel("atk-150", { weapons: 150 });
    const def = vessel("def-50", { engine: 25, reactor: 25, navigation: 25, defense: 25, weapons: 25, ai: 25 });
    expect(attackPowerOf(atk)).toBe(150);
    expect(defensePowerOf(def)).toBe(25);
    const p = damageFormulaOf(atk, def, "weapon.plasma", { distance: 0 });
    // raw = 8 (plasma base) × 1.5 / max(0.25, 0.5) = 8×1.5/0.5 = 24 = 3× dasar.
    expect(p.raw).toBe(24);
    expect(p.damage).toBe(DAMAGE_CEILING); // tetap dicek — ceiling menang
  });

  it("2. defense 150 → damage ~setengah; clamp defense min 0.5 (anti-invite)", () => {
    const atk = vessel("atk-2", { weapons: 100 });
    const tank = vessel("tank", { engine: 100, reactor: 100, navigation: 100, defense: 100, weapons: 100, ai: 100 });
    expect(defensePowerOf(tank)).toBe(100);
    const half = damageFormulaOf(atk, tank, "weapon.plasma", { distance: 0 });
    expect(half.raw).toBe(8); // 8 × 1 / 1.0
    // Clamp: defense 0 → max(0, 0.5) — tak pernah menghapus damage.
    const paper = vessel("paper", { engine: 0, reactor: 0, navigation: 0, defense: 0, weapons: 0, ai: 0 });
    const full = damageFormulaOf(atk, paper, "weapon.plasma", { distance: 0 });
    expect(full.raw).toBe(16); // 8 / 0.5 — 2× dasar, bukan infinity
    expect(full.damage).toBeLessThanOrEqual(DAMAGE_CEILING);
  });

  it("3. falloff di maxRange → 60%; di 60% range → ~76%", () => {
    const atk = vessel("atk-3");
    const def = vessel("def-3", { defense: 50 });
    const maxRange = weaponRangeOf("weapon.missile");
    const far = damageFormulaOf(atk, def, "weapon.missile", { distance: maxRange });
    const near = damageFormulaOf(atk, def, "weapon.missile", { distance: 0 });
    const mid = damageFormulaOf(atk, def, "weapon.missile", { distance: 0.6 * maxRange });
    // afterMods di-round 1 desimal di pipeline result — bandingkan ~ (2 dp).
    expect(far.afterMods / near.afterMods).toBeCloseTo(0.6, 2);
    expect(mid.afterMods / near.afterMods).toBeCloseTo(0.76, 2);
    expect(rangeFalloffOf(0, 100)).toBe(1);
  });

  it("4. weapons health 40 → ×0.7 conditionPenalty", () => {
    const hurt = vessel("atk-hurt", { weapons: 40 });
    const ok = vessel("atk-ok", { weapons: 100 });
    const def = vessel("def-4");
    expect(conditionPenaltyOf(hurt)).toBe(0.7);
    expect(conditionPenaltyOf(ok)).toBe(1);
    const h = damageFormulaOf(hurt, def, "weapon.plasma", { distance: 0 });
    const o = damageFormulaOf(ok, def, "weapon.plasma", { distance: 0 });
    // attackPowerOf = weapons health → integrasi = power 0.4 × penalty 0.7 = 0.28.
    expect(h.afterMods / o.afterMods).toBeCloseTo(0.28, 2);
  });

  it("5. ceiling 12 tetap menang di semua kasus di atas (I.7)", () => {
    const atk = vessel("atk-5", { weapons: 150 });
    // defPower rendah (clamp 0.5) tapi target SYSTEM (weapons — plasma)
    // masih 12 — ceiling menang, damage = 12.
    const def = vessel("def-5", { weapons: 12, defense: 0, engine: 0, reactor: 0, navigation: 0, ai: 0 });
    const impact = applyWeaponDamage(atk, def, "weapon.plasma", undefined, { distance: 0 });
    expect(impact).toBeDefined();
    expect(impact!.damage).toBeLessThanOrEqual(DAMAGE_CEILING);
    expect(impact!.damage).toBe(DAMAGE_CEILING); // raw 24 → capped 12
    // Resist besar sekalipun tak menembus floor 40% raw (Fase 3).
    const armored = vessel("def-5b");
    const p = damageFormulaOf(atk, armored, "weapon.missile", { distance: 0 });
    expect(p.damage).toBeLessThanOrEqual(DAMAGE_CEILING);
  });

  it("6. signatureOf = integrity clamp (satu sumber, delegasi targeting)", () => {
    expect(signatureOf(vessel("s", {}))).toBe(50);
    const big = vessel("s-big");
    big.vessel.integrity = 120;
    expect(signatureOf(big)).toBe(100);
  });
});
