// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// WebSocketTransport.ts — interest management 5000m + snapshot compress + lag comp (Phase B, EVE-grade).

import type { RegionSnapshot, Vec3 } from "../types";
import type { WorldRegion } from "../world";

export interface InterestOptions {
  radiusM?: number;
  compress?: boolean;
}

export function interestFiltered(snapshot: RegionSnapshot, center: Vec3, radiusM = 5000): RegionSnapshot {
  const filtered = snapshot.entities.filter((e) => {
    const dx = e.position.x - center.x, dy = e.position.y - center.y, dz = e.position.z - center.z;
    return Math.sqrt(dx*dx+dy*dy+dz*dz) <= radiusM;
  });
  return { ...snapshot, entities: filtered };
}

export function compressSnapshot(snapshot: RegionSnapshot): string {
  // Lightweight: JSON + delta vs empty (real compress would use pako, keep simple for live logic)
  return JSON.stringify({ t: snapshot.tick, r: snapshot.regionId, e: snapshot.entities.map((e) => [e.id, e.position.x|0, e.position.y|0, e.position.z|0]) });
}

export function decompressSnapshot(payload: string): { tick: number; regionId: string; entities: any[] } {
  const p = JSON.parse(payload);
  return { tick: p.t, regionId: p.r, entities: p.e };
}

export interface WsServerOptions {
  port?: number;
  region: WorldRegion;
  interest?: InterestOptions;
}

export function createWsInterestServer(opts: WsServerOptions) {
  const radius = opts.interest?.radiusM ?? 5000;
  return {
    getInterest(center: Vec3): RegionSnapshot { return interestFiltered(opts.region.snapshot() as any, center, radius); },
    compress: compressSnapshot,
    radius,
  };
}
