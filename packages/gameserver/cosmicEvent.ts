// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// cosmicEvent.ts — cosmic event generator (01 §2.5, 03 I.8).
// Deterministic pseudo-random per tick: meteor shower, solar storm, aurora, anomaly.

import type { EnvironsState } from "./environs";

export type CosmicEventKind = "meteor_shower" | "solar_storm" | "aurora" | "anomaly_debris";

export interface CosmicEvent {
  id: string;
  tick: number;
  kind: CosmicEventKind;
  severity: number; // 0-100
  regionId: string;
  payload: Record<string, unknown>;
}

function pseudoRandom(tick: number, seed: number): number {
  const x = Math.sin(tick * 9301 + seed * 49297) * 233280;
  return x - Math.floor(x);
}

export function generateCosmicEvents(state: EnvironsState, regionId: string, tick: number): CosmicEvent[] {
  const out: CosmicEvent[] = [];
  // Meteor shower: ~0.5% per tick
  if (pseudoRandom(tick, 1) < 0.005) {
    out.push({ id: `cosmic:${tick}:meteor`, tick, kind: "meteor_shower", severity: Math.floor(pseudoRandom(tick, 2) * 60 + 20), regionId, payload: { count: Math.floor(pseudoRandom(tick, 3) * 8 + 2) } });
  }
  // Solar storm: ~0.2% per tick, linked to star phase
  if (pseudoRandom(tick, 4) < 0.002) {
    out.push({ id: `cosmic:${tick}:storm`, tick, kind: "solar_storm", severity: Math.floor(pseudoRandom(tick, 5) * 40 + 60), regionId, payload: { starId: "star-1" } });
  }
  // Aurora: ~1% per tick, low severity
  if (pseudoRandom(tick, 6) < 0.01) {
    out.push({ id: `cosmic:${tick}:aurora`, tick, kind: "aurora", severity: Math.floor(pseudoRandom(tick, 7) * 30 + 10), regionId, payload: {} });
  }
  return out;
}
