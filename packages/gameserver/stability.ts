// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// stability.ts — world stability guard (EVE-grade).
// Heavy tapi stabil: entity cap, tick budget, memory guard, deterministic hash.

import type { WorldRegion } from "./world";
import { computeEntityHash } from "./simulation";

export const STABILITY_LIMITS = {
  maxEntities: 5000,
  maxTickMs: 80,
  maxEventLog: 10000,
};

export function checkStability(region: WorldRegion, tickMs: number, eventLogSize: number): { ok: boolean; reason?: string } {
  if (region.snapshot().entities.length > STABILITY_LIMITS.maxEntities) return { ok: false, reason: "entity_cap" };
  if (tickMs > STABILITY_LIMITS.maxTickMs) return { ok: false, reason: "tick_overbudget" };
  if (eventLogSize > STABILITY_LIMITS.maxEventLog) return { ok: false, reason: "eventlog_overflow" };
  return { ok: true };
}

export function worldHash(region: WorldRegion): string {
  const snap = region.snapshot();
  const hashes = snap.entities.filter(e => e.kind === "vessel").map(e => computeEntityHash(e as any)).sort().join("|");
  return `${snap.regionId}:${snap.tick}:${hashes.length}:${hashes.slice(0,64)}`;
}

export function shouldSnapshot(tick: number, every = 100): boolean { return tick % every === 0; }
