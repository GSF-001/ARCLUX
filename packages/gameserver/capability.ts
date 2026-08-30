// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// capability.ts — V4 special capability (07 §5/§7-9/§17/§21).
// Batas 2 kapal induk, activation max 3x, depletion, component condition.

import type { VesselEntity } from "./types";

export interface SpecialCapability {
  id: string;
  vesselId: string;
  kind: "capital" | "support";
  maxActivations: number; // 3 for capital
  activationsUsed: number;
  depleted: boolean;
  componentCondition: number; // 0-100
}

const CAPABILITY_STORE = new Map<string, SpecialCapability>();

export function registerCapability(vesselId: string, kind: "capital" | "support" = "capital"): SpecialCapability {
  const existing = CAPABILITY_STORE.get(vesselId);
  if (existing) return existing;
  const cap: SpecialCapability = { id: `cap:${vesselId}`, vesselId, kind, maxActivations: kind === "capital" ? 3 : 10, activationsUsed: 0, depleted: false, componentCondition: 100 };
  CAPABILITY_STORE.set(vesselId, cap);
  return cap;
}

export function getCapability(vesselId: string): SpecialCapability | undefined {
  return CAPABILITY_STORE.get(vesselId);
}

export function canActivate(vesselId: string): { ok: boolean; reason?: string } {
  const cap = CAPABILITY_STORE.get(vesselId);
  if (!cap) return { ok: false, reason: "no capability" };
  if (cap.depleted) return { ok: false, reason: "depleted" };
  if (cap.activationsUsed >= cap.maxActivations) return { ok: false, reason: "max activations reached" };
  if (cap.componentCondition <= 0) return { ok: false, reason: "component destroyed" };
  return { ok: true };
}

export function activateCapability(vesselId: string): { ok: boolean; reason?: string; cap?: SpecialCapability } {
  const chk = canActivate(vesselId);
  if (!chk.ok) return chk;
  const cap = CAPABILITY_STORE.get(vesselId)!;
  cap.activationsUsed++;
  cap.componentCondition = Math.max(0, cap.componentCondition - 25);
  if (cap.activationsUsed >= cap.maxActivations || cap.componentCondition <= 0) cap.depleted = true;
  return { ok: true, cap };
}

export function countCapitalForOwner(owner: string, allVessels: VesselEntity[]): number {
  return allVessels.filter((v) => v.owner === owner && CAPABILITY_STORE.get(v.id)?.kind === "capital").length;
}

export function enforceCapitalLimit(owner: string, allVessels: VesselEntity[]): boolean {
  return countCapitalForOwner(owner, allVessels) < 2;
}
