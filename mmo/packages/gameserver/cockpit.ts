// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// cockpit.ts — V5 Universal Cockpit (01 §20, blueprint 05 §20.2).
// Capability registry + HUD discovery — server exposes, client renders.

export interface CockpitCapability {
  id: string;
  label: string;
  description: string;
  available: boolean;
  requires?: string[];
}

const REGISTRY: Map<string, CockpitCapability> = new Map([
  ["nav.warp", { id: "nav.warp", label: "Warp", description: "Jump to waypoint", available: true }],
  ["nav.gate", { id: "nav.gate", label: "Gate Transit", description: "Use jump gate", available: true }],
  ["scan.directional", { id: "scan.directional", label: "D-Scan", description: "Directional scan", available: true }],
  ["intel.share", { id: "intel.share", label: "Share Intel", description: "Share waypoint to alliance", available: true }],
  ["teleport.recall", { id: "teleport.recall", label: "Recall", description: "Teleport back", available: true }],
  ["capability.activate", { id: "capability.activate", label: "Special", description: "Activate special capability", available: true }],
]);

export function getCockpitCapabilities(): CockpitCapability[] {
  return Array.from(REGISTRY.values());
}

export function registerCockpitCapability(cap: CockpitCapability): void {
  REGISTRY.set(cap.id, cap);
}

export function isCapabilityAvailable(id: string): boolean {
  return REGISTRY.get(id)?.available ?? false;
}
