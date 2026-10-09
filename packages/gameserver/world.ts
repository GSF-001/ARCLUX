// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// WorldRegion — the authoritative entity registry for one region (shard).
//
// Everything that mutates world state goes through here (or through the
// simulation engine). The region owns its entities; external code never
// mutates the map directly.

import {
  SNAPSHOT_SCHEMA_VERSION,
  type CharacterEntity,
  type GameEntity,
  type RegionSnapshot,
  type StationEntity,
  type VesselEntity,
  type WorldEntity,
} from "./types";

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

export interface SpawnCharacterOptions {
  id: string;
  owner?: string;
  vesselId: string;
  deck?: CharacterEntity["deck"];
  position?: { x: number; y: number; z: number };
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

  /** Cache stations (invalidated on mutation) — safe-zone O(stations), bukan O(n). */
  private stationsCache: StationEntity[] | null = null;

  /** P2-1 delta snapshot: perubahan menunggu di-flush saat advanceTick. */
  private pendingChanges = new Set<string>();
  private pendingRemovals = new Set<string>();
  private changedAt = new Map<string, number>();
  private removals: Array<{ id: string; tick: number }> = [];

  constructor(regionId: string, name: string) {
    this.regionId = regionId;
    this.name = name;
    this.createdAt = new Date().toISOString();
    this.tick = 0;
  }

  /** Advance tick counter (called by simulation loop). Flush delta stamps. */
  advanceTick(): void {
    this.tick += 1;
    for (const id of this.pendingChanges) this.changedAt.set(id, this.tick);
    this.pendingChanges.clear();
    for (const id of this.pendingRemovals) {
      this.removals.push({ id, tick: this.tick });
      this.changedAt.delete(id);
    }
    this.pendingRemovals.clear();
    if (this.removals.length > 1000) this.removals.splice(0, this.removals.length - 1000);
  }

  /** Tandai entity berubah pada tick berikutnya (untuk delta snapshot). */
  noteChange(id: string): void {
    this.pendingChanges.add(id);
  }

  /** Tandai entity dihapus (klien dengan lastTick < tick ini bakal diberi tahu). */
  noteRemoval(id: string): void {
    this.pendingRemovals.add(id);
  }

  /** Entity yang berubah setelah `tick` (delta snapshot P2-1). */
  changedSince(tick: number): WorldEntity[] {
    const out: WorldEntity[] = [];
    for (const [id, at] of this.changedAt) {
      if (at <= tick) continue;
      const e = this.entities.get(id);
      if (e) out.push(e);
    }
    return out;
  }

  /** ID yang dihapus setelah `tick` (delta snapshot P2-1). */
  removedSince(tick: number): string[] {
    const out: string[] = [];
    for (const r of this.removals) if (r.tick > tick) out.push(r.id);
    return out;
  }

  /** P2-9: API iterasi resmi — jangan akses private map via bracket. */
  eachEntity(cb: (e: WorldEntity) => void): void {
    for (const e of this.entities.values()) cb(e);
  }

  /** P2-9: iterable view (untuk for-of). */
  values(): IterableIterator<WorldEntity> {
    return this.entities.values();
  }

  /** P2-9: jumlah entity. */
  size(): number {
    return this.entities.size;
  }

  /** P2-9: semua vessel (cached-array tidak perlu — hasil langsung). */
  vessels(): VesselEntity[] {
    const out: VesselEntity[] = [];
    for (const e of this.entities.values()) if (e.kind === "vessel") out.push(e);
    return out;
  }

  /** P2-9/P3-3: semua station — cached, invalidasi di spawn/remove/restore. */
  stations(): StationEntity[] {
    if (!this.stationsCache) {
      const out: StationEntity[] = [];
      for (const e of this.entities.values()) if (e.kind === "station") out.push(e);
      this.stationsCache = out;
    }
    return this.stationsCache;
  }

  /** P2-9: semua karakter onboard. */
  characters(): CharacterEntity[] {
    const out: CharacterEntity[] = [];
    for (const e of this.entities.values()) if (e.kind === "character") out.push(e);
    return out;
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
  snapshot(): RegionSnapshot {
    return {
      regionId: this.regionId,
      name: this.name,
      tick: this.tick,
      createdAt: this.createdAt,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
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
    this.changedAt.set(entity.id, this.tick + 1);
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
    this.stationsCache = null;
    this.changedAt.set(entity.id, this.tick + 1);
    return entity;
  }

  spawnCharacter(opts: SpawnCharacterOptions): CharacterEntity {
    if (this.entities.has(opts.id)) {
      throw new Error(`Entity already exists in region: ${opts.id}`);
    }
    const entity: CharacterEntity = {
      id: opts.id,
      kind: "character",
      owner: opts.owner,
      vesselId: opts.vesselId,
      deck: opts.deck ?? "plaza",
      position: opts.position ?? { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      heading: { yaw: 0, pitch: 0 },
    };
    this.entities.set(entity.id, entity);
    this.changedAt.set(entity.id, this.tick + 1);
    return entity;
  }

  getCharacter(id: string): CharacterEntity | undefined {
    const e = this.entities.get(id);
    return e?.kind === "character" ? e : undefined;
  }

  remove(id: string): boolean {
    if (!this.entities.delete(id)) return false;
    this.stationsCache = null;
    this.noteRemoval(id);
    return true;
  }

  /**
   * Hydrate region INI dari persisted snapshot (E-3 lifecycle — D-013
   * "server restart ≠ world reset"). Tick + seluruh entity ditimpa dari
   * snapshot; regionId/name tetap milik region ini (caller wajib sudah
   * validasi snapshot via validateRegion/isValidResume).
   */
  restore(state: RegionSnapshot): void {
    this.tick = state.tick;
    this.entities.clear();
    this.stationsCache = null;
    this.pendingChanges.clear();
    this.pendingRemovals.clear();
    this.changedAt.clear();
    this.removals = [];
    for (const e of state.entities) this.entities.set(e.id, e);
  }
}

/** Rebuild a WorldRegion from a persisted RegionSnapshot (for recovery). */
export function regionFromState(state: RegionSnapshot): WorldRegion {
  const region = new WorldRegion(state.regionId, state.name);
  region.restore(state);
  return region;
}

/** Distance between two entities (meters). */
export function distanceBetween(a: GameEntity, b: GameEntity): number {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const dz = a.position.z - b.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
