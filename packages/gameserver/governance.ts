// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// governance.ts — dynamic safe-zone + community governance (06 §13-16, D-014).
// Validator hook for safe-zone radius and governance state. No player-initiated pause.

import type { WorldRegion } from "./world";
import type { StationEntity } from "./types";

export interface GovernanceState {
  safeZoneRadiusOverride?: Record<string, number>; // stationId -> radius
  paused: boolean; // always false — D-014 no player pause, only admin
}

let governance: GovernanceState = { paused: false };

export function getGovernance(): GovernanceState { return governance; }

export function setSafeZoneOverride(stationId: string, radius: number): void {
  governance.safeZoneRadiusOverride = governance.safeZoneRadiusOverride ?? {};
  governance.safeZoneRadiusOverride[stationId] = radius;
}

export function getEffectiveSafeZone(station: StationEntity): number {
  return governance.safeZoneRadiusOverride?.[station.id] ?? station.safeZoneRadius;
}

export function isInSafeZone(region: WorldRegion, pos: { x: number; y: number; z: number }): StationEntity | null {
  for (const e of region["entities"].values()) {
    if (e.kind !== "station") continue;
    const s = e as StationEntity;
    const r = getEffectiveSafeZone(s);
    const dx = s.position.x - pos.x, dy = s.position.y - pos.y, dz = s.position.z - pos.z;
    if (Math.sqrt(dx*dx + dy*dy + dz*dz) <= r) return s;
  }
  return null;
}

export function assertNotPaused(): void {
  if (governance.paused) throw new Error("world paused — not allowed (D-014: no player-initiated pause)");
}
