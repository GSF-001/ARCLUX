// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// component.ts — V4 component-based capability (07 §10/§22, D-019).
// usage/component_condition, event log activate_special_capability, reuse 03 I.8 replay.

export interface ComponentCondition {
  componentId: string;
  vesselId: string;
  health: number; // 0-100
  usageCount: number;
  maxUsage: number;
  depleted: boolean;
}

const components = new Map<string, ComponentCondition>();

export function registerComponent(c: ComponentCondition): void {
  components.set(c.componentId, { ...c });
}

export function getComponent(id: string): ComponentCondition | undefined {
  const c = components.get(id);
  return c ? { ...c } : undefined;
}

export function useComponent(componentId: string): { ok: boolean; reason?: string; condition?: ComponentCondition } {
  const c = components.get(componentId);
  if (!c) return { ok: false, reason: "not_found" };
  if (c.depleted || c.health <= 0) return { ok: false, reason: "depleted" };
  if (c.usageCount >= c.maxUsage) {
    c.depleted = true;
    return { ok: false, reason: "max_usage" };
  }
  c.usageCount++;
  c.health = Math.max(0, c.health - 10);
  if (c.health === 0) c.depleted = true;
  return { ok: true, condition: { ...c } };
}

export function repairComponent(componentId: string, amount: number): ComponentCondition | null {
  const c = components.get(componentId);
  if (!c) return null;
  c.health = Math.min(100, c.health + amount);
  if (c.health > 0) c.depleted = false;
  return { ...c };
}

export function listComponents(vesselId: string): ComponentCondition[] {
  return Array.from(components.values()).filter((c) => c.vesselId === vesselId).map((c) => ({ ...c }));
}
