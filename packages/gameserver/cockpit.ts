// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
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
