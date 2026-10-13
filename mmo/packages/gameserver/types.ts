// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// `packages/gameserver` — authoritative ARCLUX MMO server (D-008).
//
// This package is the referee / simulation authority of the universe. It owns
// world state, runs the tick loop, validates player intents, and emits events.
// Clients only RENDER what the server validates & simulates (Layer I).
//
// Design anchors (see docs/blueprint/progres/):
//   D-005 multi-shard, D-006 region + gates, D-008 server-authoritative,
//   D-009 self-host per shard.

/** A point in 3D region space. Components are in meters. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type FactionId = string;

export type EntityKind = "vessel" | "station" | "character" | "wreck";

/** Base identity shared by every in-world entity. */
export interface GameEntity {
  id: string;
  kind: EntityKind;
  owner?: string;
  faction?: FactionId;
  /** Position in the region's space. */
  position: Vec3;
  /** Velocity in m/s. */
  velocity: Vec3;
  /** Orientation (Euler, radians). */
  heading: { yaw: number; pitch: number };
}

/** A vessel in the world — wraps the universe VesselModel live state. */
export interface VesselEntity extends GameEntity {
  kind: "vessel";
  /** Vessel definition / stats — reused from packages/universe. */
  vessel: import("../universe/types").VesselModel;
  /** Last known state hash (anti-cheat, Layer I.5). */
  stateHash: string;
  /** Per-subsystem cooldown remaining (ticks). */
  cooldowns: Record<string, number>;
  /**
   * Emergency flight status (10.E). Absent means nominal. Persisted through
   * RegionSnapshot like any other entity field; cleared on full repair.
   */
  emergency?: VesselEmergency;
  /**
   * Kapasitor (Fase 3 blueprint 11) — state authoritative, di-tick
   * server tiap frame, persisten via RegionSnapshot. Absent = belum
   * pernah di-tick (inisialisasi lazy dari reactor pada step pertama).
   */
  capacitor?: import("../universe/capSim").CapacitorState;
}

/**
 * Persisted emergency state (10.E: ADRIFT -> FALLING -> CRASHED).
 * Derived deterministically each tick from hull integrity, velocity, and
 * planet proximity — never set by clients.
 */
export interface VesselEmergency {
  state: "adrift" | "falling" | "crashed";
  /** Region tick when this state was entered. */
  updatedTick: number;
  /** Machine-readable cause (e.g. "hull<10", "gravity-capture", "settled"). */
  cause: string;
}

/** A station — a protected social/economic anchor (02-station). */
export interface StationEntity extends GameEntity {
  kind: "station";
  name: string;
  /** Safe-zone radius in meters (default 1000). */
  safeZoneRadius: number;
  communityId?: string;
}

/** A pilot avatar inside Ark/stadium interior (Fase 8 iris 5, walkable). */
export interface CharacterEntity extends GameEntity {
  kind: "character";
  /** Vessel induk yang dimiliki pilot ini. */
  vesselId: string;
  deck: "hangar" | "promenade" | "plaza" | "habitat" | "corridor";
}

/**
 * Wreck (09-addendum §11.2 M4) — kapal hancur meninggalkan bangkai
 * volatile; loot diambil via intent `salvage` (bukan instan saat kill).
 * TTL WRECK_TTL_TICKS lalu hilang. TIDAK masuk snapshot/persistence.
 */
export interface WreckEntity extends GameEntity {
  kind: "wreck";
  /** Kapal yang hancur (asal wreck). */
  owner: string;
  /** Credits deterministik dari id kapal (salvageCreditsFor). */
  contentsCredits: number;
  /** Tick saat wreck dibuat — TTL dihitung dari sini. */
  spawnedTick: number;
}

export type WorldEntity = VesselEntity | StationEntity | CharacterEntity;

/** Live state of a single region (a shard's world). */
export interface RegionState {
  regionId: string;
  name: string;
  tick: number;
  entities: Map<string, WorldEntity>;
  /** Fixed timestamp of region creation. */
  createdAt: string;
}

/**
 * Plain, serializable snapshot of a region — for client render & persistence
 * (no live `Map`, no live object refs). This is what `WorldRegion.snapshot()`
 * returns and what `packages/gameserver/persistence` saves/loads.
 */

/** Versi skema snapshot (P2-8). Naik hanya kalau bentuk entity berubah
 *  tak-backward-compatible; loadRegion wajib migrate snapshot lama. */
export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface RegionSnapshot {
  regionId: string;
  name: string;
  tick: number;
  createdAt: string;
  /** P2-8: versi skema (undefined = snapshot pra-P2-8, treat sebagai v1). */
  schemaVersion?: number;
  /** P2-3: status time-dilation region (client slow-motion adil). */
  dilation?: DilationState;
  entities: WorldEntity[];
  /** 09 §3.5: proyeksi projectile RINGAN (posisi publik, intel minor
   *  ttl/turnRate disembunyikan). Volatile — tidak pernah dipersist. */
  projectiles?: ProjectileSnapshot[];
}

/**
 * 09 §3.1: projectile server-side (missile/torpedo). BUKAN WorldEntity —
 * array terpisah di WorldRegion, tidak masuk scan-by-default, tidak
 * dipersist (volatile §0.6).
 */
export interface ProjectileEntity {
  /** prj:<fnv1a(owner|weapon|tick|seq)> */
  id: string;
  /** Vessel penembak. */
  ownerId: string;
  /** Sumber stat — "weapon.missile" | "weapon.torpedo" | .... */
  weaponType: string;
  /** MVP homing-only; target mati = inert fly-by ke titik terakhir. */
  targetId: string;
  pos: Vec3;
  /** Arah terbang. |dir| ≤ 1 (bukan strict unit — turning bleed speed, 09 §3.2.1b). */
  dir: Vec3;
  /** Unit/tick (mis. 60 = 600u/s @10Hz). */
  speed: number;
  /** Fraction lerp arah per tick (mis. 0.12 = 12%/tick) — "bisa dielak". */
  turnRate: number;
  /** baseDamage SEBELUM pipeline (§5) — preview; resolusi hit = applyWeaponDamage. */
  damage: number;
  /** Sisa umur; habis = fizzle. */
  ttlTicks: number;
  /** >0 = masih arming; meledak baru boleh saat 0 (anti point-blank self-fizzle). */
  armTicks: number;
}

/** Proyeksi ringan projectile untuk snapshot client (09 §3.5). */
export interface ProjectileSnapshot {
  id: string;
  ownerId: string;
  targetId: string;
  pos: Vec3;
  weaponType: string;
}

/** P2-3: status time-dilation region saat ini. */
export interface DilationState {
  level: number;
  scale: number;
}

/** A validated, immutable event that happened in the world. */
export interface GameEvent {
  id: string;
  regionId: string;
  tick: number;
  type: string;
  actorId?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/** An action/command sent by a client — NOT authoritative until validated. */
export interface PlayerIntent {
  playerId: string;
  entityId: string;
  type: string;
  payload: Record<string, unknown>;
  /** Client-sent sequence for input-ordering + replay. */
  seq: number;
}
