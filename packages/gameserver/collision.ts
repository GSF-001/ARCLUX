// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// collision.ts — vessel vs cosmic body collision (03 I.9, 04 wreckage).
// Deterministic, server-authoritative. Reuses combat damage pipeline (03 I.2/I.7).

import type { Vec3, VesselEntity } from "./types";
import type { SystemBody } from "./environs";
import { applyCombatIntent } from "./combat";
import type { WorldRegion } from "./world";

function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export interface CollisionResult {
  collided: boolean;
  bodyId?: string;
  damage?: number;
  destroyed?: boolean;
}

export function checkCollisions(region: WorldRegion, bodies: SystemBody[]): CollisionResult[] {
  const results: CollisionResult[] = [];
  for (const entity of region["entities"].values()) {
    if (entity.kind !== "vessel") continue;
    const vessel = entity as VesselEntity;
    for (const body of bodies) {
      if (!body.collidable) continue;
      const d = dist(vessel.position, body.position);
      // Collision if center distance < body radius + vessel safety margin (25m)
      if (d < body.radius + 25) {
        const severity = Math.max(0, (body.radius + 25 - d) / (body.radius + 25));
        const damage = Math.ceil(severity * 100);
        // Apply via combat pipeline (subsystem damage)
        const pseudoIntent: any = { playerId: "env", entityId: vessel.id, type: "attack", payload: { targetId: vessel.id, weaponType: "collision", damage }, seq: 0 };
        try { applyCombatIntent(region, vessel, pseudoIntent, () => {}); } catch {}
        const destroyed = damage > 80;
        results.push({ collided: true, bodyId: body.id, damage, destroyed });
        if (destroyed) {
          // Wreckage: remove vessel, caller can archive via packages/provenance
          region.remove(vessel.id);
        }
        break;
      }
    }
  }
  return results;
}
