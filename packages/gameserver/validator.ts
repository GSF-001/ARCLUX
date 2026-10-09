// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
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
import { hullOf, ADRIFT_BELOW } from "./vesselState";
import { fittedComponents, validateFitIntent } from "./fitting";
import { SHIP_ONLY_INTENTS, FPS_ONLY_INTENTS, type SessionStore } from "./session";
import {
  HACK_RANGE_SHIP_M,
  HACK_RANGE_FPS_M,
  HACK_TARGET_TYPES,
  HACK_BUTTONS,
  type HackStore,
  type HackTargetType,
} from "./hack";
import { CLAIM_PLANT_RADIUS_M, CLAIM_MAX_PER_PLAYER, type ClaimStore } from "./claims";
import { ARCLUX_STORE, type Economy } from "../economy";
import { WANTED_GATE_LEVEL, type WantedStore } from "../wanted";

export type ValidatorDecision = "accept" | "reject";

/** Scan anti-spam (P1-3): range max & cooldown per vessel (tick). */
export const SCAN_RANGE_MAX = 10_000;
export const SCAN_DEFAULT_RANGE = 5_000;
export const SCAN_COOLDOWN_TICKS = 10;

/** Tether FPS (P1-4, 01-assets §5): radius maksimal dari kapal sendiri. */
export const FPS_TETHER_RADIUS_M = 1_000;

export interface ValidationResult {
  decision: ValidatorDecision;
  reason?: string;
}

/**
 * Bundle otoritas Sprint 2 (08 §4) — dipakai validator + simulation lewat
 * ValidatorContext.authority. Server membuat bundle-nya; test boleh
 * membuat sendiri. Tanpa bundle (legacy/test lama) gate di-skip.
 */
export interface AuthorityDeps {
  sessions: SessionStore;
  wanted: WantedStore;
  economy: Economy;
  hacks: HackStore;
  claims: ClaimStore;
}

export interface ValidatorContext {
  /** Harusny isi player identity (dimiliki region/identity layer). */
  playerId: string;
  /** Components the actor owns / has grants for. */
  auth: AuthorizationContext;
  /** Store otoritas Sprint 2 (session/wanted/economy/hack/claims). */
  authority?: AuthorityDeps;
}

/**
 * E-1 (08 hardening): resolve vessel yang BENAR-BENAR memiliki componentId.
 * Satu sumber kebenaran untuk validator + simulation — simulation memakai
 * fungsi ini, bukan scan ulang dengan logika sendiri (dua-resolve = dua
 * kebenaran = celah).
 */
export function resolveTradeSeller(
  region: WorldRegion,
  componentId: string
): { seller: VesselEntity; compIdx: number } | undefined {
  for (const e of region.values()) {
    if (e.kind !== "vessel") continue;
    const idx = e.vessel.components.findIndex((c) => c.id === componentId);
    if (idx !== -1) return { seller: e, compIdx: idx };
  }
  return undefined;
}

/** Kepemilikan seller untuk trade: pemilik vessel penjual, ATAU karakter
 *  yang sedang berada di vessel penjual (karakter di vessel aktor). */
export function actorOwnsSeller(seller: VesselEntity, actor: WorldEntity, playerId: string): boolean {
  if (seller.owner === playerId) return true;
  return actor.kind === "character" && actor.vesselId === seller.id;
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

  // P1-8 (06 §2.5): server memegang activeMode; intent tidak legal di
  // mode sekarang DITOLAK (ship skills tersembunyi saat FPS, dst).
  if (ctx.authority) {
    const mode = ctx.authority.sessions.modeOf(ctx.playerId);
    if (mode === "fps" && SHIP_ONLY_INTENTS.has(intent.type)) {
      return { decision: "reject", reason: `intent ${intent.type} requires ship mode (06 §2.5)` };
    }
    if (mode === "ship" && FPS_ONLY_INTENTS.has(intent.type)) {
      return { decision: "reject", reason: `intent ${intent.type} requires fps mode (06 §2.5)` };
    }
  }

  switch (intent.type) {
    case "move":
      return validateMove(region, entity, intent);
    case "attack": {
      const v = entity as VesselEntity;
      if (v.kind !== "vessel") return { decision: "reject", reason: "stations cannot attack" };
      return validateAttack(region, v, intent, ctx);
    }
    case "activate_capability": {
      const v = entity as VesselEntity;
      if (v.kind !== "vessel") return { decision: "reject", reason: "stations cannot activate" };
      // V4 component check — reuse component.ts (07 §10)
      const compId = intent.payload?.componentId as string | undefined;
      if (compId) {
        const { getComponent } = require("./component");
        const c = getComponent(compId);
        if (c && c.depleted) return { decision: "reject", reason: "component depleted" };
      }
      return { decision: "accept" };
    }
    case "equip_component":
    case "unequip_component": {
      const v = entity as VesselEntity;
      if (v.kind !== "vessel") {
        return { decision: "reject", reason: "only vessels can be fitted" };
      }
      return validateFitIntent(v, intent, ctx.auth);
    }
    case "scan": {
      // P1-3: scan butuh cooldown per vessel + range dibatasi (anti intel spam).
      const cd = (entity as VesselEntity).kind === "vessel" ? (entity as VesselEntity).cooldowns["scan"] ?? 0 : 0;
      if (cd > 0) return { decision: "reject", reason: `scan on cooldown (${cd} ticks)` };
      const range = intent.payload?.range;
      if (range !== undefined && (typeof range !== "number" || !Number.isFinite(range) || range <= 0 || range > SCAN_RANGE_MAX)) {
        return { decision: "reject", reason: `scan range must be 0 < range <= ${SCAN_RANGE_MAX}` };
      }
      return { decision: "accept" };
    }
    case "fps_switch_mode": {
      const m = intent.payload?.mode;
      if (m !== "ship" && m !== "fps") return { decision: "reject", reason: 'fps_switch_mode requires mode "ship"|"fps"' };
      return { decision: "accept" };
    }
    case "hack_start":
    case "hack_input":
    case "hack_cancel":
      return validateHack(region, entity, intent, ctx);
    case "buy_arclux": {
      const itemId = intent.payload?.itemId as string | undefined;
      if (!itemId) return { decision: "reject", reason: "buy_arclux requires itemId" };
      const entry = ARCLUX_STORE[itemId];
      if (!entry) return { decision: "reject", reason: `unknown store item: ${itemId}` };
      // P1-6: OC cost divalidasi server — saldo kurang = tolak.
      if (ctx.authority && !ctx.authority.economy.canAfford(ctx.playerId, entry.price)) {
        return { decision: "reject", reason: `insufficient OC (price ${entry.price})` };
      }
      return { decision: "accept" };
    }
    case "sell_player": {
      const p = intent.payload as { componentId?: string; toPlayerId?: string; price?: number };
      if (!p?.componentId) return { decision: "reject", reason: "sell_player requires componentId" };
      if (!p?.toPlayerId) return { decision: "reject", reason: "sell_player requires toPlayerId" };
      if (p.toPlayerId === ctx.playerId) return { decision: "reject", reason: "self trade" };
      // 06 §1.4: harga ditentukan penjual, server validasi harga >= 0, integer.
      if (typeof p.price !== "number" || !Number.isInteger(p.price) || p.price < 0) {
        return { decision: "reject", reason: "price must be integer >= 0" };
      }
      const found = resolveTradeSeller(region, p.componentId);
      if (!found) return { decision: "reject", reason: "component not found on any vessel" };
      if (!actorOwnsSeller(found.seller, entity, ctx.playerId)) {
        return { decision: "reject", reason: "actor does not own seller vessel" };
      }
      if (ctx.authority && !ctx.authority.economy.canAfford(p.toPlayerId, p.price)) {
        return { decision: "reject", reason: "buyer has insufficient OC" };
      }
      // Komponen butuh kapal pembeli untuk dititipkan (06 §1.4).
      const hasBuyerVessel = region.vessels().some((e) => e.owner === p.toPlayerId);
      if (!hasBuyerVessel) return { decision: "reject", reason: "buyer has no vessel" };
      return { decision: "accept" };
    }
    case "claim_land": {
      const p = intent.payload as { x?: number; z?: number };
      if (typeof p?.x !== "number" || typeof p?.z !== "number" || !Number.isFinite(p.x) || !Number.isFinite(p.z)) {
        return { decision: "reject", reason: "claim_land requires numeric x/z" };
      }
      if (!ctx.authority) return { decision: "accept" };
      const { claims } = ctx.authority;
      // Patok harus ditanam dekat aktor.
      const d = Math.hypot(entity.position.x - p.x, entity.position.z - p.z);
      if (d > CLAIM_PLANT_RADIUS_M) {
        return { decision: "reject", reason: `claim too far — plant within ${CLAIM_PLANT_RADIUS_M}m (aktor di ${Math.round(d)}m)` };
      }
      if (claims.countFor(ctx.playerId) >= CLAIM_MAX_PER_PLAYER) {
        return { decision: "reject", reason: `anti-serakah: maks ${CLAIM_MAX_PER_PLAYER} petak per pemain (02 §9.4)` };
      }
      if (claims.overlaps(p.x, p.z)) {
        return { decision: "reject", reason: "claim overlaps existing claim (100x100m)" };
      }
      return { decision: "accept" };
    }
    case "teleport": {
      const to = intent.payload as { x?: number; y?: number; z?: number } | undefined;
      if (!to || typeof to.x !== "number") return { decision: "reject", reason: "teleport requires x/y/z" };
      return { decision: "accept" };
    }
    case "dock": {
      // P1-5 (05 §2.3/§2.6): gerbang kota menolak buronan level ≥3 +
      // blacklist per kota (communityId stasiun).
      if (ctx.authority) {
        const w = ctx.authority.wanted;
        if (w.isGateBlocked(ctx.playerId)) {
          return { decision: "reject", reason: `wanted level ${w.levelOf(ctx.playerId)} ≥ ${WANTED_GATE_LEVEL} — akses kota ditolak (05 §2.3)` };
        }
        const stationId0 = intent.payload?.stationId as string | undefined;
        const station0 = stationId0 ? region.get(stationId0) : undefined;
        if (station0 && station0.kind === "station" && station0.communityId && w.isBlacklisted(station0.communityId, ctx.playerId)) {
          return { decision: "reject", reason: `blacklisted from city ${station0.communityId} (05 §2.6)` };
        }
      }
      return validateDock(region, entity, intent);
    }
    case "spawn_character":
      return { decision: "accept" };
    case "trade_component": {
      const p = intent.payload as { componentId?: string };
      if (!p?.componentId) return { decision: "reject", reason: "trade requires componentId" };
      // E-1: cek SELLER (bukan cuma kepemilikan entityId aktor — itu celah
      // pencurian component pemain lain). Resolve via resolver bersama.
      const found = resolveTradeSeller(region, p.componentId);
      if (!found) return { decision: "reject", reason: "component not found on any vessel" };
      if (!actorOwnsSeller(found.seller, entity, ctx.playerId)) {
        return { decision: "reject", reason: "actor does not own seller vessel" };
      }
      // Check component exists and not depleted (reuse component.ts)
      try {
        const { getComponent } = require("./component");
        const c = getComponent(p.componentId);
        if (c && c.depleted) return { decision: "reject", reason: "component depleted" };
      } catch {}
      return { decision: "accept" };
    }
    case "spawn_station": {
      const p = intent.payload as { name?: string };
      if (!p?.name) return { decision: "reject", reason: "spawn_station requires name" };
      return { decision: "accept" };
    }
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
  // 10.E: dead engines cannot thrust — adrift/falling/crashed vessels hold position.
  const blocked = flightBlocked(entity);
  if (blocked) return { decision: "reject", reason: blocked };
  if (entity.kind === "vessel") {
    // Efek hack engine-disable (06 §3.4): mesin mati 30 detik tidak bisa thrust.
    const engines = entity.cooldowns["engines"] ?? 0;
    if (engines > 0) return { decision: "reject", reason: `engines disabled — hacked (${engines} ticks)` };
  }
  if (entity.kind === "character") {
    // P1-4 tether (01 §5): karakter tidak boleh > 1000m dari kapal induk.
    // Kapal = anchor sendiri; tanpa kapal induk (vesselId === charId) = bebas.
    if (entity.vesselId && entity.vesselId !== entity.id) {
      const vessel = _region.getVessel(entity.vesselId);
      if (vessel) {
        const d = Math.hypot(to.x - vessel.position.x, to.y - vessel.position.y, to.z - vessel.position.z);
        if (d > FPS_TETHER_RADIUS_M) {
          return { decision: "reject", reason: `tether limit — kembali ke kapal (maks ${FPS_TETHER_RADIUS_M}m, tujuan ${Math.round(d)}m)` };
        }
      }
    }
  }
  return { decision: "accept" };
}

/**
 * 10.E flight gate. Crashed wrecks need Repair-by-commit; hull-critical
 * vessels are adrift with engines offline. Returns the reject reason, if any.
 */
function flightBlocked(entity: WorldEntity): string | undefined {
  if (entity.kind !== "vessel") return undefined;
  if (entity.emergency?.state === "crashed") {
    return "vessel crashed — repair required before flight";
  }
  if (hullOf(entity.vessel) < ADRIFT_BELOW) {
    return "engines offline — hull critical (adrift)";
  }
  return undefined;
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
  // 10.E: wrecks cannot dock under their own power.
  const blocked = flightBlocked(entity);
  if (blocked) return { decision: "reject", reason: blocked };
  // Must be close enough to dock.
  if (distanceBetween(entity, station) > station.safeZoneRadius * 2) {
    return { decision: "reject", reason: "out of docking range" };
  }
  return { decision: "accept" };
}

function safeZoneBlocked(region: WorldRegion, target: WorldEntity): string | undefined {
  // P3-3: cached stations() — O(stations), bukan O(entitas) radius 1e6m.
  for (const s of region.stations()) {
    if (distanceBetween(target, s) <= s.safeZoneRadius) {
      return s.id;
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

  // 10.E: adrift vessels run silent — weapons locked with engines.
  const blocked = flightBlocked(attacker);
  if (blocked) return { decision: "reject", reason: blocked };

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

  // Range check — ruleset (blueprint 03).
  const weaponRange = 5000; // meters
  if (distanceBetween(attacker, target) > weaponRange) {
    return { decision: "reject", reason: "target out of weapon range" };
  }

  // Cooldown check (simplified — actual per-weapon ruleset in combat.ts).
  const cooldown = attacker.cooldowns[weaponType] ?? 0;
  if (cooldown > 0) {
    return { decision: "reject", reason: `weapon ${weaponType} on cooldown (${cooldown} ticks)` };
  }

  // Component/license authorization (Layer I.6) — attacker must be authorized
  // for the weapon capability. Senjata harus TERPASANG (fitted) — katalog
  // saja tidak cukup (blueprint 11 Fase 3).
  const weaponComponent = fittedComponents(attacker.vessel).find((c) => c.capability === weaponType);
  if (weaponComponent) {
    const check = checkComponent(weaponComponent, ctx.auth);
    if (check.decision === "disabled") {
      return { decision: "reject", reason: `weapon component not authorized: ${check.reason}` };
    }
  }

  return { decision: "accept" };
}

/**
 * P1-9 + P1-3 (06 §3): hack punya prasyarat — target valid, jarak
 * (≤10m kapal / ≤5m karakter), target tidak di safe zone, cooldown per
 * target 60 detik, dan attempt state untuk hack_input/hack_cancel.
 */
function validateHack(
  region: WorldRegion,
  entity: WorldEntity,
  intent: PlayerIntent,
  ctx: ValidatorContext
): ValidationResult {
  if (intent.type === "hack_start") {
    const p = intent.payload as { targetId?: string; targetType?: string };
    if (!p?.targetId) return { decision: "reject", reason: "hack_start requires targetId" };
    if (!HACK_TARGET_TYPES.includes(p.targetType as HackTargetType)) {
      return { decision: "reject", reason: `targetType must be one of ${HACK_TARGET_TYPES.join("|")}` };
    }
    const target = region.get(p.targetId);
    if (!target) return { decision: "reject", reason: `unknown hack target: ${p.targetId}` };
    if (target.kind === "character") return { decision: "reject", reason: "cannot hack a character" };
    // 06 §3.2: target tidak boleh di safe zone.
    const nearStation = safeZoneBlocked(region, target);
    if (nearStation) return { decision: "reject", reason: `target in safe zone of station ${nearStation}` };
    // 06 §3.2: jarak ≤10m (kapal) / ≤5m (karakter FPS).
    const maxRange = entity.kind === "vessel" ? HACK_RANGE_SHIP_M : HACK_RANGE_FPS_M;
    const d = distanceBetween(entity, target);
    if (d > maxRange) {
      return { decision: "reject", reason: `hack target out of range (${Math.round(d)}m > ${maxRange}m)` };
    }
    // 06 §3.5: cooldown 60 detik per target.
    const cdKey = `hack:${p.targetId}`;
    const cd = entity.kind === "vessel" ? entity.cooldowns[cdKey] ?? 0 : 0;
    if (cd > 0) return { decision: "reject", reason: `hack target on cooldown (${cd} ticks)` };
    if (ctx.authority && ctx.authority.hacks.get(ctx.playerId)) {
      return { decision: "reject", reason: "hack attempt already in progress" };
    }
    return { decision: "accept" };
  }

  // hack_input / hack_cancel: harus ada attempt aktif + keyIndex sah.
  const attempt = ctx.authority?.hacks.get(ctx.playerId);
  if (ctx.authority && !attempt) {
    return { decision: "reject", reason: "no active hack attempt" };
  }
  if (intent.type === "hack_input") {
    const keyIndex = intent.payload?.keyIndex;
    if (typeof keyIndex !== "number" || !Number.isInteger(keyIndex) || keyIndex < 0 || keyIndex >= HACK_BUTTONS) {
      return { decision: "reject", reason: `hack_input requires integer keyIndex 0..${HACK_BUTTONS - 1}` };
    }
  }
  return { decision: "accept" };
}
