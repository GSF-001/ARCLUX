// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// WorldRegion — the authoritative entity registry for one region (shard).
//
// Everything that mutates world state goes through here (or through the
// simulation engine). The region owns its entities; external code never
// mutates the map directly.

import type { GameEntity, RegionState, StationEntity, VesselEntity, WorldEntity } from "./types";

export interface SpawnVesselOptions {
  id: string;
  owner?: string;
  vessel: import("../universe/types").VesselModel;
  position?: { x: number; y: number; z: number };
}

export interface SpawnStationOptions {
  id: string;
  name: string;
  owner?: string;
  communityId?: string;
  position?: { x: number; y: number; z: number };
  safeZoneRadius?: number;
}

/**
 * A region's live world. Holds the entity registry and enforces simple
 * invariants (unique ids). Simulation/validator operate on this.
 */
export class WorldRegion {
  readonly regionId: string;
  readonly name: string;
  readonly createdAt: string;
  tick: number;

  private entities = new Map<string, WorldEntity>();

  constructor(regionId: string, name: string) {
    this.regionId = regionId;
    this.name = name;
    this.createdAt = new Date().toISOString();
    this.tick = 0;
  }

  /** Advance tick counter (called by simulation loop). */
  advanceTick(): void {
    this.tick += 1;
  }

  has(id: string): boolean {
    return this.entities.has(id);
  }

  get(id: string): WorldEntity | undefined {
    return this.entities.get(id);
  }

  getVessel(id: string): VesselEntity | undefined {
    const e = this.entities.get(id);
    return e?.kind === "vessel" ? e : undefined;
  }

  /** Returns a plain snapshot (for client render / persistence, no live refs). */
  snapshot(): { regionId: string; tick: number; entities: WorldEntity[] } {
    return {
      regionId: this.regionId,
      tick: this.tick,
      entities: Array.from(this.entities.values()),
    };
  }

  /**
   * All entities within `radius` meters of a point. Used by combat targeting,
   * safe-zone checks, and proximity broadcasts.
   */
  entitiesWithin(position: { x: number; y: number; z: number }, radius: number): WorldEntity[] {
    const out: WorldEntity[] = [];
    for (const e of this.entities.values()) {
      const dx = e.position.x - position.x;
      const dy = e.position.y - position.y;
      const dz = e.position.z - position.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= radius) {
        out.push(e);
      }
    }
    return out;
  }

  spawnVessel(opts: SpawnVesselOptions): VesselEntity {
    if (this.entities.has(opts.id)) {
      throw new Error(`Entity already exists in region: ${opts.id}`);
    }
    const entity: VesselEntity = {
      id: opts.id,
      kind: "vessel",
      owner: opts.owner,
      vessel: opts.vessel,
      stateHash: "",
      cooldowns: {},
      position: opts.position ?? { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      heading: { yaw: 0, pitch: 0 },
    };
    this.entities.set(entity.id, entity);
    return entity;
  }

  spawnStation(opts: SpawnStationOptions): StationEntity {
    if (this.entities.has(opts.id)) {
      throw new Error(`Entity already exists in region: ${opts.id}`);
    }
    const entity: StationEntity = {
      id: opts.id,
      kind: "station",
      name: opts.name,
      owner: opts.owner,
      communityId: opts.communityId,
      safeZoneRadius: opts.safeZoneRadius ?? 1000,
      position: opts.position ?? { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      heading: { yaw: 0, pitch: 0 },
    };
    this.entities.set(entity.id, entity);
    return entity;
  }

  remove(id: string): boolean {
    return this.entities.delete(id);
  }
}

/** Rebuild a WorldRegion from a persisted RegionState (for recovery). */
export function regionFromState(state: RegionState): WorldRegion {
  const region = new WorldRegion(state.regionId, state.name);
  region.tick = state.tick;
  for (const e of state.entities.values()) {
    region["entities"].set(e.id, e);
  }
  return region;
}

/** Distance between two entities (meters). */
export function distanceBetween(a: GameEntity, b: GameEntity): number {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const dz = a.position.z - b.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
