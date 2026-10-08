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
import {
  validateIntent,
  resolveTradeSeller,
  actorOwnsSeller,
  type ValidatorContext,
  type AuthorityDeps,
  SCAN_RANGE_MAX,
  SCAN_DEFAULT_RANGE,
  SCAN_COOLDOWN_TICKS,
} from "./validator";
import { HACK_COOLDOWN_TICKS, HACK_WANTED_DELTA, HACK_EFFECT_TICKS, HACK_FAIL_ALARM_DELTA, fnv1a, type HackTargetType } from "./hack";
import { WITNESS_RADIUS_M, type CrimeKind } from "../wanted";
import { CLAIM_HALF_M } from "./claims";
import type { HackAttempt } from "./hack";
import { validateIntent, resolveTradeSeller, actorOwnsSeller, type ValidatorContext } from "./validator";
import { createSeedRng } from "./random";
import { projectFitAction, stepCapacitor } from "./fitting";
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
// P0-4 stability (08 hardening). Siklus statik simulation ↔ stability AMAN:
// stability memakai computeEntityHash (function declaration — di-hoist, live
// binding) hanya saat dipanggil, bukan saat init. `require()` TIDAK dipakai —
// di runtime webpack/vitest require relatif tidak resolve (gotcha repo).
import { checkStability, STABILITY_LIMITS } from "./stability";
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
  /** Bundle otoritas Sprint 2 (session/wanted/economy/hack/claims) — di-inject
   *  ke ctx tiap intent bila ctx belum membawanya. */
  authority?: AuthorityDeps;
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
  private readonly authority?: AuthorityDeps;
  private readonly environs?: EnvironsState;
  private readonly enableEnvirons: boolean;
  private pending: PlayerIntent[] = [];
  private eventLog: GameEvent[] = [];
  private eventSeq = 0;
  /** Durasi step sebelumnya (ms) — input checkStability tick_overbudget. */
  private lastTickMs = 0;

  constructor(opts: SimulationOptions) {
    this.region = opts.region;
    this.dt = opts.dt ?? 0.1; // default 10 ticks/sec
    this.authProvider = opts.authProvider;
    this.authority = opts.authority;
    this.environs = opts.environs;
    this.enableEnvirons = opts.enableEnvirons ?? !!opts.environs;
  }

  /** Enqueue a client intent for the NEXT tick. */
  enqueue(intent: PlayerIntent): void {
    this.pending.push(intent);
  }

  /** Process one tick: drain queue, validate, simulate, advance physics. */
  step(): TickResult {
    // P0-4 stability guard di awal tick (08 hardening): trip bila entity cap /
    // tick overbudget / eventlog overflow — log ke replay + rotate bila perlu.
    this.checkWorldStability();
    const stepStart = Date.now();
    const queue = this.pending;
    this.pending = [];
    const accepted: GameEvent[] = [];
    const rejected: GameEvent[] = [];

    for (const intent of queue) {
      const base = this.authProvider(intent.playerId);
      const ctx = this.authority && !base.authority ? { ...base, authority: this.authority } : base;
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
    this.stepCapacitors();
    // P1-5: decay buronan per tick (05 §2 — interval tunable di wanted.ts).
    this.authority?.wanted.decay(this.region.tick);
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
    this.lastTickMs = Date.now() - stepStart;

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
          // P1-5: hull target habis = kill — naikkan buronan bila ada saksi
          // (05 §2.2: tanpa saksi = tanpa record).
          const targetId = intent.payload?.targetId as string | undefined;
          const target = targetId ? this.region.get(targetId) : undefined;
          if (target && target.kind === "vessel" && hullOf(target.vessel) <= 0) {
            this.log("vessel_destroyed", intent.playerId, { entityId: target.id });
            this.escalateCrime(intent.playerId, target, { crime: "kill" });
          }
        }
        break;
      }
      case "activate_capability": {
        if (entity.kind === "vessel") {
          // Kapasitor habis → aktifkan kemampuan ditolak (Fase 3).
          if (entity.capacitor && entity.capacitor.current <= 0) {
            this.log("capability_rejected", intent.playerId, {
              entityId: entity.id,
              reason: "capacitor depleted",
            });
            return;
          }
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
          // P1-8 (06 §2.5): duduk di cockpit → mode ship (otomatis, server).
          ctx.authority?.sessions.setMode(intent.playerId, "ship");
          this.log("docked", intent.playerId, { entityId: entity.id, stationId });
        }
        break;
      }
      case "scan": {
        // P1-3: range dibatasi + payload minimal (id + kelas/faction saja —
        // bukan detail; privasi intel ala EVE) + cooldown per vessel.
        const rawRange = (intent.payload as any)?.range;
        const range = typeof rawRange === "number" && rawRange > 0 ? Math.min(rawRange, SCAN_RANGE_MAX) : SCAN_DEFAULT_RANGE;
        const nearby = this.region
          .entitiesWithin(entity.position, range)
          .map((e) => ({ id: e.id, kind: e.kind, faction: e.faction ?? null }));
        if (entity.kind === "vessel") entity.cooldowns["scan"] = SCAN_COOLDOWN_TICKS;
        this.log("scan_result", intent.playerId, { entityId: entity.id, count: nearby.length, nearby });
        break;
      }
      case "equip_component":
      case "unequip_component": {
        if (entity.kind === "vessel") {
          const p = intent.payload as { componentId?: string };
          if (!p.componentId) break;
          const op = intent.type === "equip_component" ? "equip" : "unequip";
          // Validator sudah memproyeksikan legalitas; commit di sini
          // murni mengomits proyeksi deterministik yang sama.
          const projected = projectFitAction(entity.vessel, op, p.componentId);
          entity.vessel.fitted = projected.fitted;
          // stateHash = receipt fit terkini (anti-cheat, Layer I.5).
          entity.stateHash = projected.fit.hash;
          this.log(intent.type, intent.playerId, {
            entityId: entity.id,
            componentId: p.componentId,
            fitHash: entity.stateHash,
          });
        }
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
      case "spawn_character": {
        const p = intent.payload as { vesselId?: string; preset?: string; armorColor?: string; emblemRepo?: string; deck?: string };
        // P0-4: spawn baru ditolak saat entity cap tercapai.
        if (this.entityCapExceeded()) {
          this.log("spawn_rejected", intent.playerId, { type: "spawn_character", reason: "entity_cap" });
          break;
        }
        const charId = `char:${intent.playerId}`;
        if (this.region.has(charId)) break;
        const vessel = p.vesselId ? this.region.getVessel(p.vesselId) : entity.kind === "vessel" ? entity : undefined;
        const deck = (p.deck as import("./types").CharacterEntity["deck"]) ?? "plaza";
        const pos = vessel ? { ...vessel.position } : { ...entity.position };
        const character = this.region.spawnCharacter({ id: charId, owner: intent.playerId, vesselId: vessel?.id ?? charId, deck, position: pos });
        recordCreation(character.id, character.vesselId, intent.playerId, this.region.tick);
        // P1-8 (06 §2.5): berdiri dari cockpit → mode fps (otomatis, server).
        ctx.authority?.sessions.setMode(intent.playerId, "fps");
        this.log("character_spawned", intent.playerId, { characterId: charId, preset: p.preset, armorColor: p.armorColor, emblemRepo: p.emblemRepo, deck });
        break;
      }
      case "fps_switch_mode": {
        // 06 §2.5: satu-satunya jalan ganti mode — keputusan server.
        const m = intent.payload?.mode as "ship" | "fps" | undefined;
        if (m !== "ship" && m !== "fps") break;
        ctx.authority?.sessions.setMode(intent.playerId, m);
        this.log("mode_switched", intent.playerId, { mode: m });
        break;
      }
      case "trade_component": {
        const p = intent.payload as { componentId?: string; fromVesselId?: string; toVesselId?: string };
        if (!p.componentId) break;
        // E-1: pakai resolver SAMA dengan validator (bukan scan ulang dengan
        // logika sendiri — dua-resolve = dua kebenaran).
        const found = resolveTradeSeller(this.region, p.componentId);
        if (!found) {
          this.log("trade_rejected", intent.playerId, { reason: "component not found", componentId: p.componentId });
          break;
        }
        const { seller, compIdx } = found;
        // Defense-in-depth: state bisa berubah antara validasi & apply tick
        // ini — cek ulang kepemilikan seller dengan aturan yang sama.
        if (!actorOwnsSeller(seller, entity, intent.playerId)) {
          this.log("trade_rejected", intent.playerId, { reason: "actor does not own seller vessel", componentId: p.componentId, seller: seller.id });
          break;
        }
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
        // P0-4: spawn baru ditolak saat entity cap tercapai.
        if (this.entityCapExceeded()) {
          this.log("spawn_rejected", intent.playerId, { type: "spawn_station", reason: "entity_cap" });
          break;
        }
        // E-5 determinisme: id dari tick+eventSeq (bukan Date.now) dan
        // posisi dari seeded rng (bukan Math.random) — replay log wajib bisa
        // merekonstruksi world state yang sama persis (D-008/Layer I.8).
        const stationId = `${this.region.regionId}:st:${this.region.tick}:${this.eventSeq}`;
        if (this.region.has(stationId)) break;
        const rng = createSeedRng(stationSeed(this.region.regionId, this.region.tick, this.eventSeq));
        const station = this.region.spawnStation({
          id: stationId,
          name: p.name ?? `Stadion ${intent.playerId}`,
          owner: intent.playerId,
          communityId: p.communityId,
          position: { x: entity.position.x + 2000 + rng.next() * 2000, y: entity.position.y, z: entity.position.z + 2000 + rng.next() * 2000 },
          safeZoneRadius: 1000,
        });
        this.log("stadium_spawned", intent.playerId, { stationId: station.id, rings: p.rings ?? 4, habitatsPerRing: p.habitatsPerRing ?? 24 });
        break;
      }
      case "buy_arclux": {
        const p = intent.payload as { itemId?: string };
        if (!p.itemId || !ctx.authority) break;
        const res = ctx.authority.economy.buyFromStore(intent.playerId, p.itemId, this.region.tick, `intent:${intent.playerId}:${intent.seq}`);
        if (res.ok && !res.replayed) {
          this.log("purchase", intent.playerId, { itemId: p.itemId, txId: res.txId });
          this.log("wallet_changed", intent.playerId, { playerId: intent.playerId, balance: ctx.authority.economy.balanceOf(intent.playerId) });
        } else if (!res.ok) {
          this.log("purchase_rejected", intent.playerId, { itemId: p.itemId, reason: res.reason });
        }
        break;
      }
      case "sell_player": {
        const p = intent.payload as { componentId?: string; toPlayerId?: string; price?: number };
        if (!p.componentId || !p.toPlayerId || !ctx.authority) break;
        const found = resolveTradeSeller(this.region, p.componentId);
        if (!found || !actorOwnsSeller(found.seller, entity, intent.playerId)) {
          this.log("trade_rejected", intent.playerId, { reason: "actor does not own seller vessel", componentId: p.componentId });
          break;
        }
        const buyer = p.toPlayerId;
        if (buyer === intent.playerId) break;
        // Kapal milik pembeli — buyer itu PLAYER-id, bukan vessel-id
        // (getVessel(buyer) salah; cari vessel yang owner-nya pembeli).
        let buyerVessel: VesselEntity | undefined;
        for (const e of this.region["entities"].values()) {
          if (e.kind === "vessel" && e.owner === buyer) { buyerVessel = e; break; }
        }
        if (!buyerVessel) {
          this.log("trade_rejected", intent.playerId, { reason: "buyer vessel not found", buyerId: buyer, componentId: p.componentId });
          break;
        }
        // OC pindah dulu (idempotency per intent seq) — gagal = tidak ada transfer barang.
        const tx = ctx.authority.economy.transfer({
          from: buyer,
          to: found.seller.owner ?? intent.playerId,
          amount: p.price ?? 0,
          idempotencyKey: `intent:${intent.playerId}:${intent.seq}`,
          tick: this.region.tick,
        });
        if (p.price && p.price > 0 && !tx.ok) {
          this.log("trade_rejected", intent.playerId, { reason: tx.reason, componentId: p.componentId });
          break;
        }
        this.moveComponent(found, buyerVessel, intent.playerId);
        this.log("trade", intent.playerId, { componentId: p.componentId, from: found.seller.id, to: buyer, price: p.price ?? 0, tax: tx.tax });
        if (p.price && p.price > 0) this.log("wallet_changed", intent.playerId, { playerId: buyer, balance: ctx.authority.economy.balanceOf(buyer) });
        break;
      }
      case "claim_land": {
        const p = intent.payload as { x?: number; z?: number };
        if (typeof p?.x !== "number" || typeof p?.z !== "number" || !ctx.authority) break;
        ctx.authority.claims.add({
          claimId: `${this.region.regionId}:cl:${this.region.tick}:${this.eventSeq}`,
          owner: intent.playerId,
          centerX: p.x,
          centerZ: p.z,
          tick: this.region.tick,
        });
        this.log("land_claimed", intent.playerId, { x: p.x, z: p.z, size: CLAIM_HALF_M * 2 });
        break;
      }
      case "hack_start": {
        if (!ctx.authority) break;
        const p = intent.payload as { targetId?: string; targetType?: HackTargetType };
        const target = p.targetId ? this.region.get(p.targetId) : undefined;
        if (!target || !p.targetType) break;
        const res = ctx.authority.hacks.start({
          actorId: intent.playerId,
          targetId: target.id,
          targetType: p.targetType,
          tick: this.region.tick,
          seed: fnv1a(`${intent.playerId}:${target.id}:${this.region.tick}`),
        });
        if (!res.ok) {
          this.log("hack_rejected", intent.playerId, { targetId: target.id, reason: res.reason });
          break;
        }
        if (entity.kind === "vessel") entity.cooldowns[`hack:${target.id}`] = HACK_COOLDOWN_TICKS;
        this.log("hack_started", intent.playerId, { targetId: target.id, targetType: p.targetType, buttons: res.attempt.sequence.length });
        break;
      }
      case "hack_input": {
        if (!ctx.authority) break;
        const keyIndex = intent.payload?.keyIndex as number;
        const res = ctx.authority.hacks.input(intent.playerId, keyIndex);
        if (!res.ok) {
          this.log("hack_rejected", intent.playerId, { reason: res.reason });
          break;
        }
        if (res.status === "accepted") {
          this.log("hack_progress", intent.playerId, { progress: res.progress, need: res.need });
        } else if (res.status === "wrong") {
          // 06 §3.5: salah tombol → fail; 3 fail berturut → alarm + wanted +2.
          this.handleHackWrong(intent.playerId, res.attempt);
        } else if (res.status === "complete") {
          this.handleHackComplete(intent.playerId, res.attempt);
        }
        break;
      }
      case "hack_cancel": {
        if (!ctx.authority) break;
        if (ctx.authority.hacks.cancel(intent.playerId)) this.log("hack_cancelled", intent.playerId, {});
        break;
      }
    }
  }

  /** Pindahkan component antar vessel + update lineage (trade/sell). */
  private moveComponent(found: { seller: VesselEntity; compIdx: number }, buyer: VesselEntity, playerId: string): void {
    const [transferred] = found.seller.vessel.components.splice(found.compIdx, 1);
    if (!transferred) return;
    try { const { transferOwnership } = require("./lineage"); transferOwnership(transferred.id, buyer.owner ?? playerId); } catch {}
    buyer.vessel.components.push(transferred);
  }

  /** Jumlah saksi unik (pemain lain dalam radius WITNESS_RADIUS_M —
   *  korban sendiri ikut dihitung; 05 §2.2 tanpa saksi = tanpa record). */
  private witnessCount(target: WorldEntity, actorId: string): number {
    const owners = new Set<string>();
    if (target.owner && target.owner !== actorId) owners.add(target.owner);
    for (const e of this.region.entitiesWithin(target.position, WITNESS_RADIUS_M)) {
      if (e.id === target.id) continue;
      if (e.owner && e.owner !== actorId) owners.add(e.owner);
    }
    return owners.size;
  }

  /** Naikkan buronan aktor dengan aturan saksi (05 §2.2). */
  private escalateCrime(actorId: string, target: WorldEntity, input: { crime?: CrimeKind; delta?: number }): void {
    const auth = this.authority;
    if (!auth) return;
    const witnessed = this.witnessCount(target, actorId) >= 1;
    const res = auth.wanted.escalate(actorId, {
      crime: input.crime,
      delta: input.delta,
      witnessed,
      tick: this.region.tick,
      chunkKey: this.region.regionId,
    });
    this.log(res.applied ? "wanted_escalated" : "wanted_ignored", actorId, {
      level: res.level,
      reason: res.reason,
      witnessed,
    });
  }

  /** Hack sukses: efek target (06 §3.4) + delta wanted bila ada saksi. */
  private handleHackComplete(actorId: string, attempt: HackAttempt): void {
    const auth = this.authority;
    if (!auth) return;
    const target = this.region.get(attempt.targetId);
    auth.hacks.recordSuccess(actorId, attempt.targetId);
    const duration = HACK_EFFECT_TICKS[attempt.targetType];
    // engine disable → mesin mati N tick (di-enforce validator `move`).
    if (attempt.targetType === "engine" && target?.kind === "vessel" && duration !== null) {
      target.cooldowns["engines"] = duration;
    }
    this.log("hack_effect", actorId, {
      targetId: attempt.targetId,
      targetType: attempt.targetType,
      durationTicks: duration,
    });
    const delta = HACK_WANTED_DELTA[attempt.targetType];
    if (delta > 0 && target) this.escalateCrime(actorId, target, { delta });
  }

  /** Hack gagal: 3 fail berturut → alarm + wanted +2 (06 §3.5). */
  private handleHackWrong(actorId: string, attempt: HackAttempt): void {
    const auth = this.authority;
    if (!auth) return;
    const target = this.region.get(attempt.targetId);
    const alarm = auth.hacks.recordFail(actorId, attempt.targetId);
    this.log("hack_failed", actorId, { targetId: attempt.targetId, targetType: attempt.targetType, alarmTriggered: alarm });
    if (alarm && target) {
      this.log("hack_effect", actorId, {
        targetId: attempt.targetId,
        targetType: "alarm",
        durationTicks: HACK_EFFECT_TICKS["alarm"],
        cause: "3 consecutive fails",
      });
      this.escalateCrime(actorId, target, { delta: HACK_FAIL_ALARM_DELTA });
    }
  }

  /** Kapasitor authoritative per tick (Fase 3 blueprint 11): drain dari
   *  powerDraw fit, regen dari reactor — formula capStep (universe)
   *  yang sama dengan proyeksi klien. */
  private stepCapacitors(): void {
    for (const e of this.region["entities"].values()) {
      if (e.kind !== "vessel") continue;
      const res = stepCapacitor(e);
      if (res.newlyDepleted) {
        this.log("capacitor_depleted", "server", { entityId: e.id, current: res.current });
      }
    }
  }

  /** P0-4 (08 hardening): stability guard di AWAL step — entity cap, tick
   *  budget (dari step sebelumnya), eventlog overflow. */
  private checkWorldStability(): void {
    const stab = checkStability(this.region, this.lastTickMs, this.eventLog.length);
    if (stab.ok) return;
    this.log("stability_trip", "server", {
      reason: stab.reason,
      entities: this.region["entities"].size,
      eventLog: this.eventLog.length,
      lastTickMs: this.lastTickMs,
    });
    if (stab.reason === "eventlog_overflow") {
      // Rotate: buang separuh event lama — replay tetap jalan, memori stabil.
      this.eventLog = this.eventLog.slice(Math.floor(this.eventLog.length / 2));
    }
  }

  /** Entity cap (STABILITY_LIMITS.maxEntities) — spawn baru wajib ditolak. */
  private entityCapExceeded(): boolean {
    return this.region["entities"].size >= STABILITY_LIMITS.maxEntities;
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

/** Seed deterministik per (region, tick, eventSeq) — FNV-1a regionId ⊕
 *  tick/seq (E-5: posisi spawn_station wajib reproducible dari input). */
function stationSeed(regionId: string, tick: number, eventSeq: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < regionId.length; i++) {
    h ^= regionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h ^ Math.imul(tick, 7919) ^ Math.imul(eventSeq, 104729)) >>> 0;
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
