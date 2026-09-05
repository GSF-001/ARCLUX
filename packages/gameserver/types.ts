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

export type EntityKind = "vessel" | "station" | "character";

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
export interface RegionSnapshot {
  regionId: string;
  name: string;
  tick: number;
  createdAt: string;
  entities: WorldEntity[];
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
