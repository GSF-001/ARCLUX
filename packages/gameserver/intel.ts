// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// intel.ts — D-021 social identity / intel sharing.

import type { GameEvent } from "./types";

export interface IntelReport {
  id: string;
  tick: number;
  targetId: string;
  targetKind: "vessel" | "station";
  faction?: string;
  classification: "green" | "yellow" | "red";
  reportedBy: string;
  payload: Record<string, unknown>;
}

const intelPool: IntelReport[] = [];

export function addIntel(report: Omit<IntelReport, "id">): IntelReport {
  const r: IntelReport = { ...report, id: `intel:${report.tick}:${intelPool.length}` };
  intelPool.push(r);
  return r;
}

export function getIntelForPlayer(playerId: string, tick: number): IntelReport[] {
  return intelPool.filter(
    (r) => r.reportedBy === playerId && r.tick <= tick
  );
}

export function classifyEntity(faction?: string, isPlayerAlly?: boolean): "green" | "yellow" | "red" {
  if (!faction) return "green";
  if (isPlayerAlly) return "green";
  return "yellow";
}

export function buildIntelEvent(report: IntelReport): GameEvent {
  return {
    id: report.id,
    regionId: "",
    tick: report.tick,
    type: "intel_update",
    actorId: report.reportedBy,
    payload: { targetId: report.targetId, classification: report.classification },
    timestamp: new Date().toISOString(),
  };
}
