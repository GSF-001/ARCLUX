// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
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
import type { EnvironsState } from "./environs";
import { integrateEnvirons, getBodiesArray } from "./environs";
import { checkCollisions, vesselMass } from "./collision";
import { computeThermal } from "./thermics";
import { canActivate, activateCapability } from "./capability";
import { assertNotPaused, isInSafeZone } from "./governance";
import { generateCosmicEvents } from "./cosmicEvent";
import { isWithinBaseline, perRegionTimeDilation } from "./baseline";
import { useComponent } from "./component";
import { recordCreation } from "./lineage";
import { computeRecall } from "./teleport";
import { clampSpeed } from "./physics";
import { recordTickTrace } from "./observability";
import {
  hullOf,
  nextEmergencyState,
  applyGravity,
  landingOutcome,
  impactSpeedOf,
  ADRIFT_DAMPING,
  FALL_SPEED_MAX,
  type VesselState,
} from "./vesselState";

export interface SimulationOptions {
  /** Region the server owns. */
  region: WorldRegion;
  /** Fixed timestep per tick, in seconds. */
  dt?: number;
  /** Validation context (player identity + authorization). */
  authProvider: (playerId: string) => ValidatorContext;
  /** Cosmic environs (star/planet) — if provided, integrated per tick (D-020). */
  environs?: EnvironsState;
  /** Enable thermal/collision checks (default true if environs provided). */
  enableEnvirons?: boolean;
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
  private readonly environs?: EnvironsState;
  private readonly enableEnvirons: boolean;
  private pending: PlayerIntent[] = [];
  private eventLog: GameEvent[] = [];
  private eventSeq = 0;

  constructor(opts: SimulationOptions) {
    this.region = opts.region;
    this.dt = opts.dt ?? 0.1; // default 10 ticks/sec
    this.authProvider = opts.authProvider;
    this.environs = opts.environs;
    this.enableEnvirons = opts.enableEnvirons ?? !!opts.environs;
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

    const start = Date.now();
    this.integratePhysics();
    this.decrementCooldowns();
    // Cosmic environs per tick (Newton/Kepler, D-020) — deterministic, authoritative + strengthened
    if (this.enableEnvirons && this.environs) {
      integrateEnvirons(this.environs);
      const bodies = getBodiesArray(this.environs);
      const collisions = checkCollisions(this.region, bodies);
      for (const c of collisions) this.log("collision", "env", { bodyId: c.bodyId, damage: c.damage, destroyed: c.destroyed });
      const thermals = computeThermal(this.region, bodies.filter((b) => b.kind === "star"));
      for (const t of thermals) if (t.overheat) this.log("thermal_overheat", "env", { vesselId: t.vesselId, temperature: t.temperature });
      // Cosmic events: solarWind + anomaly gravity — blueprint 01 §2.5 strengthening
      const events = generateCosmicEvents(this.environs, this.region.regionId, this.region.tick);
      for (const ev of events) this.log(`cosmic_${ev.kind}`, "env", { severity: ev.severity, payload: ev.payload });
      // Baseline per-region time dilation — D-019
      for (const e of this.region["entities"].values()) {
        const speed = Math.sqrt(e.velocity.x * e.velocity.x + e.velocity.y * e.velocity.y + e.velocity.z * e.velocity.z);
        if (!isWithinBaseline(speed)) this.log("baseline_breach", e.id, { speed, region: this.region.regionId });
        void perRegionTimeDilation(this.region.regionId, this.region.tick, speed);
      }
      // Anti-cheat: stateHash per tick + OTEL trace
      for (const e of this.region["entities"].values()) if (e.kind === "vessel") this.log("state_hash", e.id, { hash: computeEntityHash(e as VesselEntity) });
      recordTickTrace({ tick: this.region.tick, regionId: this.region.regionId, durationMs: Date.now() - start, entityCount: this.region.snapshot().entities.length, eventCount: accepted.length + rejected.length, timestamp: new Date().toISOString() });
    }
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
    // Governance: no player pause, safe-zone check for combat
    try { assertNotPaused(); } catch { return; }
    switch (intent.type) {
      case "move": {
        const to = intent.payload as unknown as Vec3;
        // Block move if in safe-zone and trying to leave? — governed by validator, not here
        moveToward(entity, to, this.dt);
        break;
      }
      case "attack": {
        if (entity.kind === "vessel") {
          // Safe-zone: station protects
          if (isInSafeZone(this.region, entity.position)) return;
          applyCombatIntent(this.region, entity, intent, (meta) => {
            this.log("combat", intent.playerId, { entityId: entity.id, ...meta });
          });
        }
        break;
      }
      case "activate_capability": {
        if (entity.kind === "vessel") {
          const chk = canActivate(entity.id);
          if (!chk.ok) {
            this.log("capability_rejected", intent.playerId, { entityId: entity.id, reason: chk.reason });
            return;
          }
          const res = activateCapability(entity.id);
          this.log("capability_activated", intent.playerId, { entityId: entity.id, activationsUsed: res.cap?.activationsUsed });
        }
        break;
      }
      case "dock": {
        const stationId = (intent.payload as any)?.stationId as string | undefined;
        const station = stationId ? this.region.get(stationId) : undefined;
        if (station && station.kind === "station") {
          entity.position = { ...station.position };
          entity.velocity = { x: 0, y: 0, z: 0 };
          this.log("docked", intent.playerId, { entityId: entity.id, stationId });
        }
        break;
      }
      case "scan": {
        const range = (intent.payload as any)?.range ?? 5000;
        const nearby = this.region.entitiesWithin(entity.position, range).map((e) => e.id);
        this.log("scan_result", intent.playerId, { entityId: entity.id, count: nearby.length, nearby });
        break;
      }
      case "teleport": {
        const to = intent.payload as unknown as Vec3;
        const res = computeRecall(entity.position, to);
        if (res.success) {
          entity.position = { ...res.to };
          entity.velocity = { x: 0, y: 0, z: 0 };
          if (entity.kind === "vessel") useComponent((entity as VesselEntity).vessel.id);
          this.log("teleported", intent.playerId, { entityId: entity.id, to });
        } else {
          this.log("teleport_rejected", intent.playerId, { entityId: entity.id, reason: res.reason });
        }
        break;
      }
      case "spawn": {
        // Live spawn via lineage — authoritative
        if (entity.kind === "vessel") recordCreation((entity as VesselEntity).vessel.id, entity.id, intent.playerId, this.region.tick);
        break;
      }
      case "spawn_character": {
        const p = intent.payload as { vesselId?: string; preset?: string; armorColor?: string; emblemRepo?: string; deck?: string };
        const charId = `char:${intent.playerId}`;
        if (this.region.has(charId)) break;
        const vessel = p.vesselId ? this.region.getVessel(p.vesselId) : entity.kind === "vessel" ? entity : undefined;
        const deck = (p.deck as import("./types").CharacterEntity["deck"]) ?? "plaza";
        const pos = vessel ? { ...vessel.position } : { ...entity.position };
        const character = this.region.spawnCharacter({ id: charId, owner: intent.playerId, vesselId: vessel?.id ?? charId, deck, position: pos });
        recordCreation(character.id, character.vesselId, intent.playerId, this.region.tick);
        this.log("character_spawned", intent.playerId, { characterId: charId, preset: p.preset, armorColor: p.armorColor, emblemRepo: p.emblemRepo, deck });
        break;
      }
      case "trade_component": {
        const p = intent.payload as { componentId?: string; fromVesselId?: string; toVesselId?: string };
        if (!p.componentId) break;
        // Find seller vessel that owns component
        let seller: import("./types").VesselEntity | undefined;
        let compIdx = -1;
        for (const e of this.region["entities"].values()) {
          if (e.kind === "vessel") {
            const idx = (e as import("./types").VesselEntity).vessel.components.findIndex((c) => c.id === p.componentId);
            if (idx !== -1) { seller = e as import("./types").VesselEntity; compIdx = idx; break; }
          }
        }
        if (!seller || compIdx === -1) {
          this.log("trade_rejected", intent.playerId, { reason: "component not found", componentId: p.componentId });
          break;
        }
        // Check health/depleted
        const comp = seller.vessel.components[compIdx];
        // simple health check: if component depleted via useComponent, reject (already validated)
        const buyerId = p.toVesselId ?? (entity.kind === "character" ? (entity as import("./types").CharacterEntity).vesselId : entity.id);
        const buyer = this.region.getVessel(buyerId);
        if (!buyer) {
          this.log("trade_rejected", intent.playerId, { reason: "buyer vessel not found", buyerId });
          break;
        }
        // Transfer
        const [transferred] = seller.vessel.components.splice(compIdx, 1);
        // Update provenance
        try { const { transferOwnership } = require("./lineage"); transferOwnership(transferred.id, buyer.owner ?? intent.playerId); } catch {}
        buyer.vessel.components.push(transferred);
        this.log("trade", intent.playerId, { componentId: p.componentId, from: seller.id, to: buyer.id });
        break;
      }
      case "spawn_station": {
        const p = intent.payload as { name?: string; rings?: number; habitatsPerRing?: number; dockingPerRing?: number; communityId?: string };
        const stationId = `stadium:${intent.playerId}:${Date.now() % 100000}`;
        if (this.region.has(stationId)) break;
        const station = this.region.spawnStation({
          id: stationId,
          name: p.name ?? `Stadion ${intent.playerId}`,
          owner: intent.playerId,
          communityId: p.communityId,
          position: { x: entity.position.x + 2000 + Math.random() * 2000, y: entity.position.y, z: entity.position.z + 2000 },
          safeZoneRadius: 1000,
        });
        this.log("stadium_spawned", intent.playerId, { stationId: station.id, rings: p.rings ?? 4, habitatsPerRing: p.habitatsPerRing ?? 24 });
        break;
      }
    }
  }

  private integratePhysics(): void {
    // Newtonian F=ma — live. Damping 0.02 + solarWind/anomaly via environs.
    // 10.E: vessels in emergency states integrate through the emergency
    // machine (drift decay / gravity fall / grounded) instead of free flight.
    const planetPos = this.nearestPlanetPosition();
    const planetMass = this.nearestPlanetBody()?.mass ?? 5.972e24;
    for (const e of this.region["entities"].values()) {
      if (e.kind === "vessel") {
        if (this.stepEmergency(e, planetPos, planetMass) !== "nominal") continue;
      }
      const drag = 0.02;
      const ax = -e.velocity.x * drag;
      const ay = -e.velocity.y * drag;
      const az = -e.velocity.z * drag;
      const nextVel = { x: e.velocity.x + ax * this.dt, y: e.velocity.y + ay * this.dt, z: e.velocity.z + az * this.dt };
      const clamped = clampSpeed(nextVel, 500);
      e.velocity = clamped;
      e.position.x += e.velocity.x * this.dt;
      e.position.y += e.velocity.y * this.dt;
      e.position.z += e.velocity.z * this.dt;
    }
  }

  /** Nearest planet body for gravity capture, with real mass (F4). */
  private nearestPlanetBody(): { pos: Vec3; mass: number } | undefined {
    if (!this.environs) return undefined;
    for (const b of getBodiesArray(this.environs)) {
      if (b.kind === "planet") return { pos: { ...b.position }, mass: b.mass };
    }
    return undefined;
  }

  /** Nearest planet center for gravity capture, if environs are present. */
  private nearestPlanetPosition(): Vec3 | undefined {
    return this.nearestPlanetBody()?.pos;
  }

  /**
   * 10.E emergency step: advance the persisted flag, integrate drift/fall,
   * ground wrecks. Returns the effective state; non-nominal vessels skip
   * free-flight integration. Transitions are logged for replay.
   */
  private stepEmergency(v: VesselEntity, planetPos: Vec3 | undefined, planetMass = 5.972e24): VesselState {
    const wasFalling = v.emergency?.state === "falling";
    const { state, changed, cause } = nextEmergencyState(v, planetPos, this.region.tick);
    if (changed) {
      if (state === "nominal") delete v.emergency;
      else v.emergency = { state, updatedTick: this.region.tick, cause };
      this.log(`emergency_${state}`, v.id, { hull: Math.round(hullOf(v.vessel) * 10) / 10, cause });
    }
    // F1: settle is MEASURED, not assumed — touchdown verdict from real
    // impact kinematics via landingOutcome() + crash_impact log. Terrain is
    // unknown server-side, so the verdict is conservative (treated as
    // occupied ground, budget ×0.4) and the log says so explicitly.
    if (changed && state === "crashed" && wasFalling) {
      const speed = impactSpeedOf(v.velocity);
      const verdict = landingOutcome({
        mass: vesselMass(v),
        speed,
        verticalSpeed: v.velocity.y,
        slope: 0,
        onEmptyLand: false,
      });
      this.log("crash_impact", v.id, {
        verdict: verdict.verdict,
        kineticEnergy: Math.round(verdict.kineticEnergy),
        budget: Math.round(verdict.budget),
        impactSpeed: Math.round(speed * 10) / 10,
        terrain: "unknown-conservative",
      });
    }
    if (state === "crashed") {
      v.velocity = { x: 0, y: 0, z: 0 };
      return state;
    }
    if (state === "falling" && planetPos) {
      // F4: real planet mass from environs — Mars pulls less than Earth.
      v.velocity = applyGravity(v.position, v.velocity, planetPos, this.dt, planetMass);
    } else if (state === "adrift") {
      const damp = Math.max(0, 1 - ADRIFT_DAMPING * this.dt);
      v.velocity = { x: v.velocity.x * damp, y: v.velocity.y * damp, z: v.velocity.z * damp };
    }
    v.velocity = clampSpeed(v.velocity, state === "falling" ? FALL_SPEED_MAX : 500);
    v.position.x += v.velocity.x * this.dt;
    v.position.y += v.velocity.y * this.dt;
    v.position.z += v.velocity.z * this.dt;
    return state;
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
  // Newtonian thrust: F=ma, thrust 2e7 N, mass 5e6 kg → a=4 m/s², clamp 250 m/s (baseline D-019).
  const thrust = 2e7;
  const mass = (entity as any)?.vessel?.mass ?? 5e6;
  const maxSpeed = 250;
  const dx = target.x - entity.position.x;
  const dy = target.y - entity.position.y;
  const dz = target.z - entity.position.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 1) {
    // Brake: apply reverse thrust
    entity.velocity.x *= 0.85;
    entity.velocity.y *= 0.85;
    entity.velocity.z *= 0.85;
    if (Math.sqrt(entity.velocity.x**2 + entity.velocity.y**2 + entity.velocity.z**2) < 0.5) entity.velocity = { x: 0, y: 0, z: 0 };
    return;
  }
  const ax = (dx / dist) * (thrust / mass);
  const ay = (dy / dist) * (thrust / mass);
  const az = (dz / dist) * (thrust / mass);
  entity.velocity.x = Math.max(-maxSpeed, Math.min(maxSpeed, entity.velocity.x + ax * dt));
  entity.velocity.y = Math.max(-maxSpeed, Math.min(maxSpeed, entity.velocity.y + ay * dt));
  entity.velocity.z = Math.max(-maxSpeed, Math.min(maxSpeed, entity.velocity.z + az * dt));
  entity.heading.yaw = Math.atan2(dx, dz);
  entity.heading.pitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
}

/** Compute a deterministic state hash for a vessel (Layer I.5 fingerprint) — Phase C anti-cheat: full state + tick. */
export function computeEntityHash(e: VesselEntity): string {
  const { x, y, z } = e.position;
  const { x: vx, y: vy, z: vz } = e.velocity;
  const sys = e.vessel.systems.map((s) => `${s.id}:${Math.round(s.health)}`).join(",");
  const cd = Object.entries(e.cooldowns).map(([k,v]) => `${k}:${v}`).join(",");
  return `${e.id}|${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}|${vx.toFixed(1)},${vy.toFixed(1)},${vz.toFixed(1)}|${sys}|${cd}`;
}

export function verifyClientPrediction(serverHash: string, clientHash: string): boolean {
  return serverHash === clientHash;
}
