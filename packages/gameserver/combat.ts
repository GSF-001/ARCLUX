// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Combat simulation (Layer I.2, I.7) — authoritative.
//
// Damage is applied PER SUBSYSTEM (not a single HP bar), reusing the universe
// `SystemState` health values. There is a hard damage ceiling per tick so a
// single hit cannot one-shot (I.7). All outcomes are deterministic and pushed
// as combat events for replay (I.8). Visual rendering happens client-side only.

import type { PlayerIntent, VesselEntity } from "./types";
import type { WorldRegion } from "./world";

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

  const subsystemId = resolveTargetSubsystem(weaponType);
  const sys = target.vessel.systems.find((s) => s.id === subsystemId);
  if (!sys) return undefined;

  const rawCapability = attackPower(attacker, weaponType);
  const damage = applyDamageCeiling(rawCapability, sys.health);

  const before = sys.health;
  sys.health = Math.max(SUBSYSTEM_DESTROYED_AT, before - damage);
  const destroyed = sys.health <= SUBSYSTEM_DESTROYED_AT;

  // Set a cooldown on the attacker's weapon so it can't fire every tick.
  attacker.cooldowns[weaponType] = cooldownTicks(weaponType);

  const impact: CombatImpact = {
    targetId,
    subsystemId,
    before,
    after: sys.health,
    damage,
    destroyed,
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

/** Raw damage from attacker capability + weapon (before ceiling). */
function attackPower(attacker: VesselEntity, weaponType: string): number {
  const weaponStat = attacker.vessel.systems.find((s) => s.id === "weapons")?.health ?? 50;
  const base = 4 + (weaponStat / 100) * 8; // 4..12
  return Math.round(base * 10) / 10;
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
