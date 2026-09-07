// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/localVolumes.ts - 10.X.4 Local effect volumes around player/landing/facility (rain/vegetation/dust/wake/fog/god rays/particles), distant = low cost. Zoom dari blueprint "Local effect volumes around player/landing/facility (rain/vegetation/dust/wake/fog/god rays/particles), distant = low cost".

// WIRE NOTE for SESSION 2: import { createLocalVolumeManager, updateLocalVolumes } from "./planetary/localVolumes" di scene3d/index.ts. Manager per player/facility, update tiap frame dengan player pos + facility pos.

import * as THREE from "three";

export type VolumeKind = "player" | "facility" | "landing";

export interface LocalVolume {
  id: string;
  kind: VolumeKind;
  center: THREE.Vector3;
  radius: number; // 80..300
  active: boolean;
  cost: number; // 0..1
}

export interface LocalVolumeManager {
  volumes: Map<string, LocalVolume>;
}

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
    v = { id, kind, center: new THREE.Vector3(center.x, center.y, center.z), radius, active: true, cost: 0 };
    mgr.volumes.set(id, v);
  } else {
    v.center.set(center.x, center.y, center.z);
    v.radius = radius;
    v.active = true;
  }
  return v;
}

/**
 * Update: distant volumes -> low cost, near -> full. Cost via distance + kind importance.
 * - player volume always cost 1 if active (near)
 * - facility 200m radius cost 0.8 within 80m, 0.2 beyond 200m
 * - landing transient cost 1 during touchdown, 0.1 after
 * SESSION 2 reads v.cost to decide whether to tick rain/vegetation/dust/wake per volume.
 */
export function updateLocalVolumes(
  mgr: LocalVolumeManager,
  playerPos: { x: number; y: number; z: number },
  dt: number,
): void {
  for (const v of mgr.volumes.values()) {
    const dist = v.center.distanceTo(new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z));
    // Cost = importance * distanceFactor
    const importance = v.kind === "player" ? 1.0 : v.kind === "landing" ? 0.9 : 0.7;
    const distFactor = dist < v.radius * 0.4 ? 1 : dist < v.radius ? 1 - (dist - v.radius * 0.4) / (v.radius * 0.6) * 0.6 : 0.15;
    v.cost = Math.max(0, Math.min(1, importance * distFactor));
    // Auto deactivate if far > 2*radius for 5s (SESSION 2 can cull)
    if (dist > v.radius * 2) {
      (v as any)._farTime = ((v as any)._farTime ?? 0) + dt;
      if ((v as any)._farTime > 5) v.active = false;
    } else {
      (v as any)._farTime = 0;
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

