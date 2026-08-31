// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// lineage.ts — V4 provenance lineage (07 §13-15, reuse packages/provenance).
// component survive ship/destruction, wreckage lineage, owner history.

export interface LineageRecord {
  componentId: string;
  vesselId: string;
  owner: string;
  createdTick: number;
  destroyedTick?: number;
  survived: boolean;
  wreckageId?: string;
}

const lineage = new Map<string, LineageRecord>();

export function recordCreation(componentId: string, vesselId: string, owner: string, tick: number): LineageRecord {
  const rec: LineageRecord = { componentId, vesselId, owner, createdTick: tick, survived: true };
  lineage.set(componentId, rec);
  return { ...rec };
}

export function recordDestruction(componentId: string, tick: number, wreckageId?: string): LineageRecord | null {
  const rec = lineage.get(componentId);
  if (!rec) return null;
  rec.destroyedTick = tick;
  rec.survived = !!wreckageId;
  rec.wreckageId = wreckageId;
  return { ...rec };
}

export function transferOwnership(componentId: string, newOwner: string): LineageRecord | null {
  const rec = lineage.get(componentId);
  if (!rec) return null;
  rec.owner = newOwner;
  return { ...rec };
}

export function getLineage(componentId: string): LineageRecord | undefined {
  const r = lineage.get(componentId);
  return r ? { ...r } : undefined;
}

export function listSurvived(): LineageRecord[] {
  return Array.from(lineage.values()).filter((r) => r.survived).map((r) => ({ ...r }));
}
