// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Combat simulation (Layer I.2, I.7) — authoritative.
//
// Damage is applied PER SUBSYSTEM (not a single HP bar), reusing the universe
// `SystemState` health values. There is a hard damage ceiling per tick so a
// single hit cannot one-shot (I.7). All outcomes are deterministic and pushed
// as combat events for replay (I.8). Visual rendering happens client-side only.

import type { PlayerIntent, VesselEntity } from "./types";
import type { WorldRegion } from "./world";
import { computeResists, MAX_RESIST } from "../universe/fitCalc";
import type { DamageType } from "../universe/types";
import { fitDefinitionsOf } from "./fitting";
import { distanceBetween } from "./world";
import {
  attackPowerOf,
  defensePowerOf,
  rangeFalloffOf,
  conditionPenaltyOf,
  weaponRangeOf,
} from "./stats";
import { WEAPON_DEFS } from "./projectiles";

/** Max damage a single attack can deal, per subsystem (Layer I.7 ceiling). */
export const DAMAGE_CEILING = 12;

/** Whether a fully depleted subsystem counts as "destroyed". */
export const SUBSYSTEM_DESTROYED_AT = 0;

export interface CombatImpact {
  targetId: string;
  subsystemId: string;
  before: number;
  after: number;
  damage: number;
  destroyed: boolean;
  /** Poin damage yang terserap resistensi fit target (Fase 3). */
  resisted?: number;
}

export type CombatLogger = (meta: Record<string, unknown>) => void;

/**
 * Apply a validated attack intent to a target vessel. Called ONLY after the
 * WorldValidator has accepted the intent. Reduces the target subsystem health
 * by a ruleset-bounded amount and records the impact.
 */
export function applyCombatIntent(
  region: WorldRegion,
  attacker: VesselEntity,
  intent: PlayerIntent,
  logger?: CombatLogger
): CombatImpact | undefined {
  const targetId = intent.payload?.targetId as string | undefined;
  const weaponType = intent.payload?.weapon as string | undefined;
  if (!targetId || !weaponType) return undefined;

  const target = region.getVessel(targetId);
  if (!target) return undefined;

  const impact = applyWeaponDamage(attacker, target, weaponType, logger, {
    distance: distanceBetween(attacker, target),
  });
  // Set a cooldown on the attacker's weapon so it can't fire every tick.
  if (impact) attacker.cooldowns[weaponType] = cooldownTicks(weaponType);
  return impact;
}

/**
 * Satu pipa damage (D-008): turret hitscan DAN projectile hit (09 §3.2.2)
 * SEMUA lewat sini — resist target, ceiling 12, subsystem. Tanpa cooldown
 * (caller yang atur — spawn missile sudah kena cooldown saat ditembak).
 */
export function applyWeaponDamage(
  attacker: VesselEntity,
  target: VesselEntity,
  weaponType: string,
  logger?: CombatLogger,
  ctx?: DamageContext
): CombatImpact | undefined {
  const subsystemId = resolveTargetSubsystem(weaponType);
  const sys = target.vessel.systems.find((s) => s.id === subsystemId);
  if (!sys) return undefined;

  const pipeline = damageFormulaOf(attacker, target, weaponType, ctx);
  const damage = applyDamageCeiling(pipeline.afterResist, sys.health);

  const before = sys.health;
  sys.health = Math.max(SUBSYSTEM_DESTROYED_AT, before - damage);
  const destroyed = sys.health <= SUBSYSTEM_DESTROYED_AT;

  const impact: CombatImpact = {
    targetId: target.id,
    subsystemId,
    before,
    after: sys.health,
    damage,
    destroyed,
    resisted: pipeline.resisted,
  };

  logger?.({
    attackerId: attacker.id,
    ...impact,
    weaponType,
  });

  return impact;
}

/** Map a weapon capability to the subsystem it damages. */
function resolveTargetSubsystem(weaponType: string): string {
  switch (weaponType) {
    case "weapon.plasma":
    case "weapon.railgun":
      return "weapons";
    case "weapon.missile":
      return "defense";
    case "weapon.emp":
      return "engine";
    case "weapon.explosive":
      return "reactor";
    default:
      return "defense";
  }
}

/** Konteks opsional pipeline (09 §5.2). */
export interface DamageContext {
  /** Jarak penembak→target (atau projectile→target saat hit). Default 0. */
  distance?: number;
}

export interface DamagePipeline {
  subsystemId: string;
  resist: number;
  /** base × attacker/100 / max(defense/100, 0.5). */
  raw: number;
  /** raw × rangeFalloff × conditionPenalty (mod hooks, urutan tetap). */
  afterMods: number;
  /** afterMods × (1 − resist). */
  afterResist: number;
  /** resisted ≥ 0 (poin yang terserap). */
  resisted: number;
  /** min(afterResist, DAMAGE_CEILING, sys.health). */
  damage: number;
}

/**
 * Formula damage (09 §5.2) — pure, deterministik:
 *   raw        = basePower(weapon) × (attackPowerOf/100) / max(defensePowerOf/100, 0.5)
 *   afterMods  = applyMods(raw)   // rangeFalloff → conditionPenalty
 *   afterResist= afterMods × (1 − resist)
 *   damage     = min(afterResist, DAMAGE_CEILING, targetSys.health)
 * Dipakai applyWeaponDamage + test (assertion per tahap, §5.3).
 */
export function damageFormulaOf(
  attacker: VesselEntity,
  target: VesselEntity,
  weaponType: string,
  ctx?: DamageContext
): DamagePipeline {
  const subsystemId = resolveTargetSubsystem(weaponType);
  const sys = target.vessel.systems.find((s) => s.id === subsystemId);
  const dtype = damageTypeOf(weaponType);
  const resist = dtype ? resistFactor(target, dtype) : 0;

  const raw =
    (basePowerOf(weaponType) * (attackPowerOf(attacker) / 100)) /
    Math.max(defensePowerOf(target) / 100, 0.5);
  // Mod hooks — urutan tetap, murni, deterministik (Sprint 5 menambah di
  // array yang SAMA: booster, skill aktif, hack effect).
  const afterMods = raw * rangeFalloffOf(ctx?.distance ?? 0, weaponRangeOf(weaponType)) * conditionPenaltyOf(attacker);
  const afterResistRaw = afterMods * (1 - resist);
  const afterResist = Math.round(afterResistRaw * 10) / 10;
  const resisted = Math.max(0, Math.round((afterMods - afterResistRaw) * 10) / 10);
  const damage = sys ? applyDamageCeiling(afterResist, sys.health) : applyDamageCeiling(afterResist, 0);

  return { subsystemId, resist, raw: Math.round(raw * 10) / 10, afterMods: Math.round(afterMods * 10) / 10, afterResist, resisted, damage };
}

/** Base power per senjata — WEAPON_DEFS (projectile) atau tabel turret. */
function basePowerOf(weaponType: string): number {
  const def = WEAPON_DEFS[weaponType];
  if (def) return def.baseDamage;
  switch (weaponType) {
    case "weapon.plasma": return 8;
    case "weapon.railgun": return 9;
    case "weapon.emp": return 6;
    case "weapon.explosive": return 10;
    default: return 8;
  }
}

/** Clamp damage to the ruleset ceiling, never dipping below 0. */
function applyDamageCeiling(raw: number, currentHealth: number): number {
  const capped = Math.min(raw, DAMAGE_CEILING);
  return Math.min(capped, currentHealth);
}

/** Cooldown (in ticks) per weapon archetype. */
function cooldownTicks(weaponType: string): number {
  switch (weaponType) {
    case "weapon.missile": return 6;
    case "weapon.emp": return 8;
    case "weapon.explosive": return 10;
    default: return 4;
  }
}

const DAMAGE_TYPES: DamageType[] = ["plasma", "railgun", "missile", "emp", "explosive"];

/** "weapon.plasma" → "plasma". Weapon tak dikenal → undefined (tanpa resist). */
function damageTypeOf(weaponType: string): DamageType | undefined {
  const t = weaponType.startsWith("weapon.") ? weaponType.slice("weapon.".length) : weaponType;
  return DAMAGE_TYPES.includes(t as DamageType) ? (t as DamageType) : undefined;
}

/**
 * Resistensi fit TARGET untuk satu tipe damage (0..MAX_RESIST).
 * Delegasi ke fitCalc::computeResists — dihitung dari komponen
 * yang benar-benar terpasang, bukan katalog.
 */
function resistFactor(target: VesselEntity, type: DamageType): number {
  const resists = computeResists(fitDefinitionsOf(target.vessel));
  return Math.min(MAX_RESIST, resists[type] ?? 0);
}
