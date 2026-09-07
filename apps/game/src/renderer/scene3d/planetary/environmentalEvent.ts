// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/environmentalEvent.ts - 10.G G1-G2 Continuous Environmental Event + Weather Accumulation: CLEAR->PRE->STORM->LANDING->POST->RECOVERY + WET->DRAINING->DRYING. Zoom dari blueprint G1-G2.

// WIRE NOTE for SESSION 2: import { deriveEnvironmentalEvent, tickEnvironmentalEvent } from "./planetary/environmentalEvent" di scene3d/index.ts. Derive dari EnvironmentalContext, tick per frame untuk puddle/vegetation mist.

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type EventPhase = "clear" | "pre" | "storm" | "landing" | "post" | "recovery";

export interface EnvironmentalEvent {
  eventId: string;
  phase: EventPhase;
  startedAt: number; // ms
  weatherKind: "clear" | "overcast" | "rain" | "storm";
  windSpeed: number;
  puddle: number; // 0..1 WET->DRAINING->DRYING
  vegetationWet: number; // 0..1
  mist: number; // 0..1 POST-STORM mist
}

export function deriveEnvironmentalEvent(ctx: EnvironmentalContext, now: number, prev: EnvironmentalEvent | null): EnvironmentalEvent {
  const kind = ctx.weather.kind;
  const wind = ctx.wind.speed;
  const intensity = ctx.weather.precipitationIntensity;
  // Phase machine: clear -> pre (cloud 0.5+ wind 6+) -> storm (rain/storm) -> landing (if vessel near) -> post (genangan) -> recovery -> clear
  let phase: EventPhase = prev?.phase ?? "clear";
  if (kind === "clear" && intensity < 0.1) {
    phase = prev?.phase === "post" || prev?.phase === "recovery" ? "recovery" : "clear";
    if (prev && now - prev.startedAt > 180000) phase = "clear"; // 3min recovery -> clear
  } else if (kind === "overcast" && wind > 6) {
    phase = "pre";
  } else if (kind === "rain" || kind === "storm") {
    phase = "storm";
  }
  // Puddle/mist derived: WET->DRAINING->DRYING (post storm puddle surut 0.015/sec)
  let puddle = prev?.puddle ?? 0;
  if (phase === "storm") puddle = Math.min(1, puddle + intensity * 0.02);
  else if (phase === "post" || phase === "recovery") puddle = Math.max(0, puddle - 0.008);
  const vegetationWet = Math.min(1, puddle * 0.6 + intensity * 0.4);
  const mist = phase === "post" ? Math.min(1, puddle * 0.5 + 0.2) : phase === "recovery" ? puddle * 0.3 : 0;
  const eventId = prev?.eventId ?? `evt-${ctx.planetId}-${Math.floor(now / 60000)}`;
  return { eventId, phase, startedAt: prev?.startedAt ?? now, weatherKind: kind, windSpeed: wind, puddle, vegetationWet, mist };
}

export function isPostStorm(event: EnvironmentalEvent): boolean {
  return event.phase === "post" || event.phase === "recovery";
}
