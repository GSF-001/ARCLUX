// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// SimulationEngine — deterministic tick loop for a region.
//
//   - Collects queued PlayerIntents for the tick.
//   - Validates each via WorldValidator; rejected intents are logged (replay).
//   - Applies movement + combat from accepted intents.
//   - Advances physics (velocity -> position) with fixed dt per tick.
//   - Records every accepted/rejected intent as a GameEvent (input-queue +
//     event replay, Layer I.8 / riesgo #6 determinism).
//
// This is the authoritative sim (D-008): clients send intent, server computes
// truth.

import type { GameEvent, PlayerIntent, Vec3, VesselEntity, WorldEntity } from "./types";
import { WorldRegion } from "./world";
import { validateIntent, type ValidatorContext } from "./validator";
import { applyCombatIntent } from "./combat";

export interface SimulationOptions {
  /** Region the server owns. */
  region: WorldRegion;
  /** Fixed timestep per tick, in seconds. */
  dt?: number;
  /** Validation context (player identity + authorization). */
  authProvider: (playerId: string) => ValidatorContext;
}

export interface TickResult {
  accepted: GameEvent[];
  rejected: GameEvent[];
  tick: number;
  snapshot: ReturnType<WorldRegion["snapshot"]>;
}

/**
 * Runs the authoritative server loop. In production this is invoked N times
 * per second by a scheduler; here step() is the pure single-tick primitive.
 */
export class SimulationEngine {
  readonly region: WorldRegion;
  private readonly dt: number;
  private readonly authProvider: (playerId: string) => ValidatorContext;
  private pending: PlayerIntent[] = [];
  private eventLog: GameEvent[] = [];
  private eventSeq = 0;

  constructor(opts: SimulationOptions) {
    this.region = opts.region;
    this.dt = opts.dt ?? 0.1; // default 10 ticks/sec
    this.authProvider = opts.authProvider;
  }

  /** Enqueue a client intent for the NEXT tick. */
  enqueue(intent: PlayerIntent): void {
    this.pending.push(intent);
  }

  /** Process one tick: drain queue, validate, simulate, advance physics. */
  step(): TickResult {
    const queue = this.pending;
    this.pending = [];
    const accepted: GameEvent[] = [];
    const rejected: GameEvent[] = [];

    for (const intent of queue) {
      const ctx = this.authProvider(intent.playerId);
      const verdict = validateIntent(this.region, intent, ctx);
      if (verdict.decision === "reject") {
        rejected.push(this.log("intent_rejected", intent.playerId, {
          entityId: intent.entityId,
          type: intent.type,
          seq: intent.seq,
          reason: verdict.reason,
        }));
        continue;
      }

      accepted.push(this.log(`intent_${intent.type}`, intent.playerId, {
        entityId: intent.entityId,
        type: intent.type,
        seq: intent.seq,
        payload: intent.payload,
      }));

      this.applyIntent(intent, ctx);
    }

    this.integratePhysics();
    this.decrementCooldowns();
    this.region.advanceTick();

    return {
      accepted,
      rejected,
      tick: this.region.tick,
      snapshot: this.region.snapshot(),
    };
  }

  /** The full event log (replay foundation). */
  replayLog(): GameEvent[] {
    return [...this.eventLog];
  }

  private log(type: string, actorId: string, payload: Record<string, unknown>): GameEvent {
    const ev: GameEvent = {
      id: `${this.region.regionId}:${this.region.tick}:${this.eventSeq++}`,
      regionId: this.region.regionId,
      tick: this.region.tick,
      type,
      actorId,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.eventLog.push(ev);
    return ev;
  }

  private applyIntent(intent: PlayerIntent, ctx: ValidatorContext): void {
    const entity = this.region.get(intent.entityId);
    if (!entity) return;
    switch (intent.type) {
      case "move": {
        const to = intent.payload as unknown as Vec3;
        moveToward(entity, to, this.dt);
        break;
      }
      case "attack": {
        if (entity.kind === "vessel") {
          applyCombatIntent(this.region, entity, intent, (meta) => {
            this.log("combat", intent.playerId, { entityId: entity.id, ...meta });
          });
        }
        break;
      }
      case "dock":
      case "scan":
        // handled by validator/log; no authoritative state change here yet.
        break;
    }
  }

  private integratePhysics(): void {
    // Simple verlet-lite: position += velocity * dt. Authoritative motion.
    for (const e of this.region["entities"].values()) {
      e.position.x += e.velocity.x * this.dt;
      e.position.y += e.velocity.y * this.dt;
      e.position.z += e.velocity.z * this.dt;
    }
  }

  private decrementCooldowns(): void {
    for (const e of this.region["entities"].values()) {
      if (e.kind !== "vessel") continue;
      for (const key of Object.keys(e.cooldowns)) {
        e.cooldowns[key] = Math.max(0, (e.cooldowns[key] ?? 1) - 1);
      }
    }
  }
}

function moveToward(entity: WorldEntity, target: Vec3, dt: number): void {
  // Simple: set velocity toward target point (not instant teleport), then the
  // physics integrator moves it. Speed is a placeholder constant (m/s).
  const speed = 250;
  const dx = target.x - entity.position.x;
  const dy = target.y - entity.position.y;
  const dz = target.z - entity.position.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 1) {
    entity.velocity = { x: 0, y: 0, z: 0 };
    return;
  }
  entity.velocity = {
    x: (dx / dist) * speed,
    y: (dy / dist) * speed,
    z: (dz / dist) * speed,
  };
  // Update heading to face the travel direction.
  entity.heading.yaw = Math.atan2(dx, dz);
  entity.heading.pitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
}

/** Compute a deterministic state hash for a vessel (Layer I.5 fingerprint). */
export function computeEntityHash(e: VesselEntity): string {
  const { x, y, z } = e.position;
  const sys = e.vessel.systems.map((s) => `${s.id}:${Math.round(s.health)}`).join(",");
  return `${e.id}|${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}|${sys}`;
}
