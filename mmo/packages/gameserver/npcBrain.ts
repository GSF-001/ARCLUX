// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// npcBrain.ts — NPC AI combat (09-combat-depth §4).
//
// State machine PATROL→DETECT→CHASE→AIM→FIRE (+RETURN), tick-based port dari
// EnemyShip.cpp (PawnSensing "cukup mengarah?" → aim hold → fire). Think
// cadence 3 tick offset hash(id)%3 (20 AI tak pernah spike bersamaan). NPC =
// VesselEntity biasa, damage lewat applyWeaponDamage SAMA (ceiling/resist),
// tanpa god-mode; kill NPC tanpa wanted (05 §2). Friendly-fire AI OFF.

import type { Vec3, VesselEntity } from "./types";
import type { WorldRegion as Region } from "./world";
import type { VesselModel } from "../universe/types";
import { applyWeaponDamage } from "./combat";
import { steerToward } from "./physics";
import { isInSafeZone } from "./governance";
import { createSeedRng } from "./random";
import { angleToPosDeg, LOCK_CONE_DEG } from "./targeting";

// ── Tuning (§4.1) ────────────────────────────────────────────────────────

export const NPC_SENSOR_RANGE_M = 4000;
export const NPC_WEAPON_RANGE_M = 5000; // = validator weaponRange baseline
export const NPC_THINK_PERIOD_TICKS = 3;
export const NPC_DETECT_CONFIRM_TICKS = 2; // think-count, bukan tick mentah
export const NPC_AIM_HOLD_TICKS = 2;       // think-count
export const NPC_FIRE_COOLDOWN_TICKS = 6;
export const NPC_MAX_ACTIVE_PER_REGION = 20;
export const NPC_RETURN_ARRIVE_M = 80;
export const NPC_WAVE_SPAWN_STAGGER_TICKS = 1;
export const NPC_WAVE_PRE_ROLL_TICKS = 3;
export const NPC_WAVE_DEADLINE_TICKS = 600;
export const NPC_SALVAGE_UNITS_MAX = 3;
export const NPC_SALVAGE_CREDITS_PER_UNIT = 50;

// ── Faction matrix (§4.1) ────────────────────────────────────────────────

export const FACTION_MATRIX: Record<string, { hostile: string[] }> = {
  pirate: { hostile: ["*"] },     // pirate = hostil ke semua non-pirate
  convoy: { hostile: ["pirate"] },
  militia: { hostile: ["pirate"] },
  trader: { hostile: [] },
};

/** Friendly-fire OFF: faksi sendiri tidak pernah hostil. */
export function isHostile(factionA: string, factionB: string): boolean {
  if (factionA === factionB) return false;
  const m = FACTION_MATRIX[factionA];
  if (!m) return false;
  return m.hostile.includes("*") || m.hostile.includes(factionB);
}

/** Faksi dari field entity / owner "npc:<faction>:<idx>" / default trader. */
export function factionOf(e: { owner?: string }): string {
  const owner = e.owner ?? "";
  if (owner.startsWith("npc:")) return owner.split(":")[1] ?? "pirate";
  return "trader";
}

// ── Store ────────────────────────────────────────────────────────────────

export type NpcState = "patrol" | "detect" | "chase" | "aim" | "fire" | "return";

export interface NpcBrain {
  vesselId: string;
  faction: string;
  state: NpcState;
  targetId?: string;
  patrolPoint: Vec3;
  /** Tick saat masuk state sekarang. */
  stateSince: number;
  /** Think-count dalam state detect/aim (cadence 3 tick). */
  holdThinks: number;
}

export function createNpcStore() {
  const brains = new Map<string, NpcBrain>();
  return {
    get: (id: string) => brains.get(id),
    all: () => [...brains.values()],
    add: (b: NpcBrain) => { brains.set(b.vesselId, b); },
    remove: (id: string) => { brains.delete(id); },
    get size() { return brains.size; },
  };
}
export type NpcStore = ReturnType<typeof createNpcStore>;

// ── Wave store (§4.3) ────────────────────────────────────────────────────

export type WavePhase = "idle" | "wait" | "spawning" | "in_progress" | "completed" | "failed";

export interface WaveState {
  phase: WavePhase;
  wave: number;
  total: number;
  spawned: number;
  /** Pre-roll spawn point (seeded) — stagger spawn 1/tick. */
  pending: Array<{ faction: string; position: Vec3; patrolPoint: Vec3 }>;
  /** Tick saat masuk phase sekarang. */
  since: number;
  deadlineTick: number;
  /** Total credits salvage selama wave ini (diisi sim saat npc_killed). */
  salvage: number;
}

export function createWaveStore(): { state: WaveState } {
  return {
    state: {
      phase: "idle", wave: 0, total: 0, spawned: 0, pending: [],
      since: 0, deadlineTick: 0, salvage: 0,
    },
  };
}
export type WaveStore = ReturnType<typeof createWaveStore>;

// ── NPC vessel (§4.2 — bukan god-mode, model standar) ────────────────────

/** Model NPC deterministik (sederhana, tanpa dependency loadtest/universe). */
export function npcVesselModel(faction: string, idx: number): VesselModel {
  const subs = ["engine", "reactor", "navigation", "defense", "weapons", "ai"];
  return {
    id: `npc-${faction}-${idx}`,
    name: `NPC ${faction} #${idx}`,
    source: { org: "npc", repo: faction, defaultBranch: "main", analyzedAt: "2026-01-01T00:00:00Z" },
    license: "open",
    systems: subs.map((s) => ({ id: s, label: s, health: 70, baseStat: 70 })),
    components: [],
    integrity: 60,
    defense: 70,
    weapons: 70,
    engine: 70,
  } as unknown as VesselModel;
}

export interface SpawnNpcOptions {
  id: string;
  faction: string;
  position: Vec3;
  patrolPoint: Vec3;
}

/** Spawn NPC = VesselEntity biasa + brain terdaftar. */
export function spawnNpc(region: Region, store: NpcStore, opts: SpawnNpcOptions): VesselEntity {
  const vessel = region.spawnVessel({
    id: opts.id,
    owner: `npc:${opts.faction}:${opts.id}`,
    vessel: npcVesselModel(opts.faction, 0),
    position: opts.position,
  });
  store.add({
    vesselId: opts.id,
    faction: opts.faction,
    state: "patrol",
    patrolPoint: opts.patrolPoint,
    stateSince: region.tick,
    holdThinks: 0,
  });
  return vessel;
}

// ── Think (§4.1) ─────────────────────────────────────────────────────────

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface NpcHooks {
  /** Satu pipa damage (ceiling/resist) — sama dgn turret player. */
  applyDamage: typeof applyWeaponDamage;
  log: (type: string, meta: Record<string, unknown>) => void;
  /** Dipanggil saat kapal mati oleh AI (bisa NPC atau pemain) — sim menangani salvage/wanted. */
  onKill?: (destroyed: VesselEntity, killerId: string | undefined) => void;
}

/**
 * Satu langkah NPC AI (dipanggil simulation tiap tick). Think cadence:
 * `(tick + hash(id)) % NPC_THINK_PERIOD_TICKS === 0` — 20 AI tersebar di
 * 3 tick. Damage = applyWeaponDamage (pipeline SAMA, ceiling 12).
 */
export function stepNpcs(region: Region, store: NpcStore, tick: number, hooks: NpcHooks): void {
  const dt = 0.1; // = effDt default simulation (10 Hz)
  for (const brain of store.all()) {
    const npc = region.get(brain.vesselId);
    if (!npc || npc.kind !== "vessel") { store.remove(brain.vesselId); continue; }
    // Hull habis: biarkan sim yang bersihkan (kill handler) — skip think.
    if ((npc.vessel.systems.reduce((a, s) => a + s.health, 0)) <= 0) continue;
    if ((tick + fnv1a(brain.vesselId)) % NPC_THINK_PERIOD_TICKS !== 0) continue;

    const target = brain.targetId ? region.get(brain.targetId) : undefined;
    const targetAlive = target?.kind === "vessel"
      && target.vessel.systems.reduce((a, s) => a + s.health, 0) > 0
      && isHostile(brain.faction, factionOf(target));

    // State apa pun: target masuk safe-zone → RETURN (AI tak pernah
    // menembak di safe-zone, §4.1).
    if (brain.state !== "patrol" && brain.state !== "return" && target && isInSafeZone(region, target.position)) {
      setState(brain, "return", tick);
      brain.targetId = undefined;
    }

    switch (brain.state) {
      case "patrol": {
        steerToward(npc, brain.patrolPoint, dt);
        const hostile = nearestHostile(region, store, npc, brain.faction);
        if (hostile) {
          brain.targetId = hostile.id;
          brain.holdThinks = 0;
          setState(brain, "detect", tick);
        } else if (dist2(npc.position, brain.patrolPoint) < NPC_RETURN_ARRIVE_M ** 2) {
          npc.velocity.x = 0; npc.velocity.y = 0; npc.velocity.z = 0;
        }
        break;
      }
      case "detect": {
        // Lock-like confirm N think sebelum chase (anti target-switch flicker).
        if (!targetAlive) { brain.targetId = undefined; setState(brain, "patrol", tick); break; }
        brain.holdThinks += 1;
        if (brain.holdThinks >= NPC_DETECT_CONFIRM_TICKS) setState(brain, "chase", tick);
        break;
      }
      case "chase": {
        if (!targetAlive) { brain.targetId = undefined; setState(brain, "patrol", tick); break; }
        steerToward(npc, target!.position, dt);
        const d2 = dist2(npc.position, target!.position);
        if (d2 <= NPC_WEAPON_RANGE_M ** 2 && angleToPosDeg(npc, target!.position) <= LOCK_CONE_DEG) {
          brain.holdThinks = 0;
          setState(brain, "aim", tick);
        }
        break;
      }
      case "aim": {
        // PawnSensing kedua: cukup mengarah? (cone) — hold N think → fire.
        if (!targetAlive) { brain.targetId = undefined; setState(brain, "patrol", tick); break; }
        const d2 = dist2(npc.position, target!.position);
        if (d2 > NPC_WEAPON_RANGE_M ** 2 || angleToPosDeg(npc, target!.position) > LOCK_CONE_DEG) {
          setState(brain, "chase", tick);
          break;
        }
        brain.holdThinks += 1;
        if (brain.holdThinks >= NPC_AIM_HOLD_TICKS) setState(brain, "fire", tick);
        break;
      }
      case "fire": {
        if (!targetAlive) {
          brain.targetId = undefined;
          setState(brain, "patrol", tick);
          break;
        }
        const cd = npc.cooldowns["weapon.plasma"] ?? 0;
        if (cd > 0) break; // cooldown senjata — tunggu (state tetap fire)
        const dist = Math.hypot(
          npc.position.x - target!.position.x,
          npc.position.y - target!.position.y,
          npc.position.z - target!.position.z
        );
        const impact = hooks.applyDamage(npc, target!, "weapon.plasma", (meta) => {
          hooks.log("npc_combat", { attackerId: npc.id, ...meta });
        }, { distance: dist });
        npc.cooldowns["weapon.plasma"] = NPC_FIRE_COOLDOWN_TICKS;
        hooks.log("npc_attack", { attackerId: npc.id, targetId: target!.id, hit: !!impact });
        if (impact?.destroyed) hooks.onKill?.(target!, npc.owner);
        setState(brain, "chase", tick); // re-acquire cycle (null-out timer 0.1s)
        break;
      }
      case "return": {
        steerToward(npc, brain.patrolPoint, dt);
        if (dist2(npc.position, brain.patrolPoint) < NPC_RETURN_ARRIVE_M ** 2) {
          setState(brain, "patrol", tick);
        }
        break;
      }
    }
  }
}

function setState(brain: NpcBrain, state: NpcState, tick: number): void {
  brain.state = state;
  brain.stateSince = tick;
  brain.holdThinks = 0;
}

function dist2(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function nearestHostile(region: Region, store: NpcStore, npc: VesselEntity, faction: string): VesselEntity | undefined {
  let best: VesselEntity | undefined;
  let bestD2 = Infinity;
  const r2 = NPC_SENSOR_RANGE_M ** 2;
  for (const e of region.snapshot().entities) {
    if (e.kind !== "vessel" || e.id === npc.id) continue;
    if (store.get(e.id)) continue; // NPC tidak saling serang (MVP)
    if (!isHostile(faction, factionOf(e))) continue;
    const v = e as VesselEntity;
    if (v.vessel.systems.reduce((a, s) => a + s.health, 0) <= 0) continue;
    const d2 = dist2(npc.position, v.position);
    if (d2 <= r2 && d2 < bestD2) { best = v; bestD2 = d2; }
  }
  return best;
}

// ── Wave spawner (§4.3) ──────────────────────────────────────────────────

export interface RequestWaveOptions {
  seed: number;
  count: number;
  origin: Vec3;
  faction?: string;
}

/**
 * Trigger wave (admin/dev): pre-roll spawn point seeded → stagger 1/tick.
 * Budget: aktif NPC + count > MAX_AI_ACTIVE_PER_REGION → reject.
 */
export function requestWave(
  region: Region,
  npcs: NpcStore,
  waves: WaveStore,
  opts: RequestWaveOptions,
  tick: number
): { ok: boolean; reason?: string } {
  const active = npcs.size;
  // Budget: wave > kapasitas tersisa = reject total (§4.3 — tanpa clamp diam).
  const count = Math.max(1, opts.count);
  if (active + count > NPC_MAX_ACTIVE_PER_REGION) {
    return { ok: false, reason: "ai_budget" };
  }
  if (waves.state.phase === "spawning" || waves.state.phase === "in_progress" || waves.state.phase === "wait") {
    return { ok: false, reason: "wave_active" };
  }
  const faction = opts.faction ?? "pirate";
  const rng = createSeedRng(opts.seed);
  const pending = Array.from({ length: count }, (_, i) => {
    const angle = rng.range(0, Math.PI * 2);
    const r = 1500 + rng.range(0, 500);
    const position = {
      x: Math.round((opts.origin.x + Math.cos(angle) * r) * 100) / 100,
      y: 0,
      z: Math.round((opts.origin.z + Math.sin(angle) * r) * 100) / 100,
    };
    const patrolAngle = rng.range(0, Math.PI * 2);
    return {
      faction,
      position,
      patrolPoint: {
        x: Math.round((opts.origin.x + Math.cos(patrolAngle) * 2500) * 100) / 100,
        y: 0,
        z: Math.round((opts.origin.z + Math.sin(patrolAngle) * 2500) * 100) / 100,
      },
      idx: i,
    };
  });
  waves.state = {
    phase: "wait",
    wave: waves.state.wave + 1,
    total: count,
    spawned: 0,
    pending: pending.map(({ faction: f, position, patrolPoint }) => ({ faction: f, position, patrolPoint })),
    since: tick,
    deadlineTick: 0,
    salvage: 0,
  };
  // Id unik per spawn: wave + idx (deterministik — seed sama = id sama).
  (waves.state as WaveState & { seed?: number }).seed = opts.seed;
  return { ok: true };
}

/**
 * Advance wave state machine (dipanggil simulation tiap tick, setelah NPC).
 * WAIT → pre-roll → SPAWNING (1/tick) → IN_PROGRESS → COMPLETED/FAILED.
 */
export function stepWaves(region: Region, npcs: NpcStore, waves: WaveStore, tick: number, log: (type: string, meta: Record<string, unknown>) => void): void {
  const st = waves.state;
  const seed = (st as WaveState & { seed?: number }).seed ?? 1;
  switch (st.phase) {
    case "wait": {
      if (tick - st.since >= NPC_WAVE_PRE_ROLL_TICKS) {
        st.phase = "spawning";
        st.since = tick;
        log("wave_started", { wave: st.wave, count: st.total });
      }
      break;
    }
    case "spawning": {
      const next = st.pending[st.spawned];
      if (next) {
        spawnNpc(region, npcs, {
          id: `npc-w${st.wave}-${st.spawned}-${fnv1a(String(seed)) % 100000}`,
          faction: next.faction,
          position: next.position,
          patrolPoint: next.patrolPoint,
        });
        st.spawned += 1;
      }
      if (st.spawned >= st.total) {
        st.phase = "in_progress";
        st.since = tick;
        st.deadlineTick = tick + NPC_WAVE_DEADLINE_TICKS;
      }
      break;
    }
    case "in_progress": {
      const alive = npcs.all().filter((b) => {
        const v = region.get(b.vesselId);
        return v?.kind === "vessel" && v.vessel.systems.reduce((a, s) => a + s.health, 0) > 0;
      }).length;
      if (alive === 0) {
        st.phase = "completed";
        st.since = tick;
        log("wave_completed", { wave: st.wave, salvage: st.salvage });
      } else if (tick >= st.deadlineTick) {
        st.phase = "failed";
        st.since = tick;
        log("wave_failed", { wave: st.wave, remaining: alive });
      }
      break;
    }
    default:
      break;
  }
}

/** Salvage credits deterministik per NPC mati (drop table minimal). */
export function salvageCreditsFor(npcId: string): number {
  const rng = createSeedRng(fnv1a(npcId));
  return rng.int(1, NPC_SALVAGE_UNITS_MAX) * NPC_SALVAGE_CREDITS_PER_UNIT;
}

/** NPC ID prefix check — kill handler membedakan NPC vs pemain. */
export function isNpcEntity(e: { owner?: string }): boolean {
  return (e.owner ?? "").startsWith("npc:");
}