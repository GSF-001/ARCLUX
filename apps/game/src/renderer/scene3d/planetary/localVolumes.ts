// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/localVolumes.ts - 10.X.4 local effect volumes.
// Effects are only simulated at full cost near the player, landing site, or
// facility; distant volumes decay to a cheap share. The frame loop reads
// each volume cost to decide which resolvers tick at full rate.
// Pure manager logic: no authority state, no rendering.

import * as THREE from "three";

export type VolumeKind = "player" | "facility" | "landing";

const IMPORTANCE: Record<VolumeKind, number> = { player: 1.0, landing: 0.9, facility: 0.7 };
const FAR_MULTIPLIER = 2;
const FAR_TIMEOUT_SEC = 5;

export interface LocalVolume {
  id: string;
  kind: VolumeKind;
  center: THREE.Vector3;
  radius: number; // 80..300
  active: boolean;
  cost: number; // 0..1 effect budget share
  farTime: number; // seconds spent beyond deactivation range
}

export interface LocalVolumeManager {
  volumes: Map<string, LocalVolume>;
}

const _toPlayer = new THREE.Vector3();

export function createLocalVolumeManager(): LocalVolumeManager {
  return { volumes: new Map() };
}

export function ensureVolume(
  mgr: LocalVolumeManager,
  id: string,
  kind: VolumeKind,
  center: { x: number; y: number; z: number },
  radius: number,
): LocalVolume {
  let v = mgr.volumes.get(id);
  if (!v) {
    v = { id, kind, center: new THREE.Vector3(center.x, center.y, center.z), radius, active: true, cost: 0, farTime: 0 };
    mgr.volumes.set(id, v);
  } else {
    v.center.set(center.x, center.y, center.z);
    v.radius = radius;
    v.active = true;
  }
  return v;
}

/**
 * Recompute every volume cost from player distance. Full cost inside 40% of
 * the radius, fading to a floor beyond the edge. Volumes far outside twice
 * the radius for over 5 seconds deactivate until re-ensured.
 */
export function updateLocalVolumes(
  mgr: LocalVolumeManager,
  playerPos: { x: number; y: number; z: number },
  dt: number,
): void {
  for (const v of mgr.volumes.values()) {
    _toPlayer.set(playerPos.x, playerPos.y, playerPos.z);
    const dist = v.center.distanceTo(_toPlayer);
    const importance = IMPORTANCE[v.kind];
    let distFactor: number;
    if (dist < v.radius * 0.4) distFactor = 1;
    else if (dist < v.radius) distFactor = 1 - ((dist - v.radius * 0.4) / (v.radius * 0.6)) * 0.6;
    else distFactor = 0.15;
    v.cost = Math.max(0, Math.min(1, importance * distFactor));
    if (dist > v.radius * FAR_MULTIPLIER) {
      v.farTime += dt;
      if (v.farTime > FAR_TIMEOUT_SEC) v.active = false;
    } else {
      v.farTime = 0;
      v.active = true;
    }
  }
}

export function getVolumeCost(mgr: LocalVolumeManager, id: string): number {
  return mgr.volumes.get(id)?.cost ?? 0;
}

export function disposeVolume(mgr: LocalVolumeManager, id: string): void {
  mgr.volumes.delete(id);
}

export function countActiveVolumes(mgr: LocalVolumeManager): number {
  let n = 0;
  for (const v of mgr.volumes.values()) if (v.active) n++;
  return n;
}
