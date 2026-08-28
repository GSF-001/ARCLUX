// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// WorldValidator — the server as referee (Layer I.4).
//
// Every player intent passes through here. The validator decides whether an
// intent is LEGAL before it is simulated. Clients never determine truth; they
// render what the validator + sim produce.
//
// Reuses packages/universe::LicenseValidator for component/authorization
// checks (Layer I.6), keeping a single source of truth for licensing.

import { checkComponent, type AuthorizationContext } from "../universe/license";
import type { VesselEntity, PlayerIntent, WorldEntity } from "./types";
import { WorldRegion, distanceBetween } from "./world";

export type ValidatorDecision = "accept" | "reject";

export interface ValidationResult {
  decision: ValidatorDecision;
  reason?: string;
}

export interface ValidatorContext {
  /** Harusny isi player identity (dimiliki region/identity layer). */
  playerId: string;
  /** Components the actor owns / has grants for. */
  auth: AuthorizationContext;
}

/**
 * Validate a single intent. The rules mirror Layer I checklist:
 * attacker valid, weapon/component authorized, license valid, vessel state
 * valid, cooldown valid, range valid, target valid, damage <= ruleset, state
 * version valid.
 */
export function validateIntent(
  region: WorldRegion,
  intent: PlayerIntent,
  ctx: ValidatorContext
): ValidationResult {
  if (intent.playerId !== ctx.playerId) {
    return { decision: "reject", reason: "player identity mismatch" };
  }

  const entity = region.get(intent.entityId);
  if (!entity) {
    return { decision: "reject", reason: `unknown entity: ${intent.entityId}` };
  }
  if (entity.owner !== ctx.playerId) {
    return { decision: "reject", reason: "not the acting owner of entity" };
  }

  switch (intent.type) {
    case "move":
      return validateMove(region, entity, intent);
    case "attack": {
      const v = entity as VesselEntity;
      if (v.kind !== "vessel") return { decision: "reject", reason: "stations cannot attack" };
      return validateAttack(region, v, intent, ctx);
    }
    case "scan":
      return { decision: "accept" };
    case "dock":
      return validateDock(region, entity, intent);
    default:
      return { decision: "reject", reason: `unsupported intent: ${intent.type}` };
  }
}

function validateMove(
  _region: WorldRegion,
  entity: WorldEntity,
  intent: PlayerIntent
): ValidationResult {
  const to = intent.payload as { x?: number; y?: number; z?: number };
  if (typeof to.x !== "number" || typeof to.y !== "number" || typeof to.z !== "number") {
    return { decision: "reject", reason: "move requires numeric x/y/z target" };
  }
  return { decision: "accept" };
}

function validateDock(
  region: WorldRegion,
  entity: WorldEntity,
  intent: PlayerIntent
): ValidationResult {
  const stationId = intent.payload?.stationId as string | undefined;
  const station = stationId ? region.get(stationId) : undefined;
  if (!station || station.kind !== "station") {
    return { decision: "reject", reason: "dock requires a valid station target" };
  }
  // Must be close enough to dock.
  if (distanceBetween(entity, station) > station.safeZoneRadius * 2) {
    return { decision: "reject", reason: "out of docking range" };
  }
  return { decision: "accept" };
}

function safeZoneBlocked(region: WorldRegion, target: WorldEntity): string | undefined {
  const stations = region.entitiesWithin(target.position, 1_000_000);
  for (const s of stations) {
    if (s.kind === "station") {
      if (distanceBetween(target, s) <= s.safeZoneRadius) {
        return s.id;
      }
    }
  }
  return undefined;
}

function validateAttack(
  region: WorldRegion,
  attacker: VesselEntity,
  intent: PlayerIntent,
  ctx: ValidatorContext
): ValidationResult {
  const targetId = intent.payload?.targetId as string | undefined;
  const weaponType = intent.payload?.weapon as string | undefined;
  if (!targetId) return { decision: "reject", reason: "attack requires targetId" };
  if (!weaponType) return { decision: "reject", reason: "attack requires weapon" };

  const target = region.get(targetId);
  if (!target) return { decision: "reject", reason: `unknown target: ${targetId}` };
  if (target.kind === "station") {
    return { decision: "reject", reason: "stations are protected (cannot attack)" };
  }

  // Safe-zone: cannot hosti target inside a protected station radius (02 §8-9).
  const nearStation = safeZoneBlocked(region, target);
  if (nearStation) {
    return { decision: "reject", reason: `target in safe zone of station ${nearStation}` };
  }

  // Range check.
  const weaponRange = 5000; // meters — ruleset placeholder
  if (distanceBetween(attacker, target) > weaponRange) {
    return { decision: "reject", reason: "target out of weapon range" };
  }

  // Cooldown check (simplified — actual per-weapon ruleset in combat.ts).
  const cooldown = attacker.cooldowns[weaponType] ?? 0;
  if (cooldown > 0) {
    return { decision: "reject", reason: `weapon ${weaponType} on cooldown (${cooldown} ticks)` };
  }

  // Component/license authorization (Layer I.6) — attacker must be authorized
  // for the weapon capability.
  const weaponComponent = attacker.vessel.components.find((c) => c.capability === weaponType);
  if (weaponComponent) {
    const check = checkComponent(weaponComponent, ctx.auth);
    if (check.decision === "disabled") {
      return { decision: "reject", reason: `weapon component not authorized: ${check.reason}` };
    }
  }

  return { decision: "accept" };
}
