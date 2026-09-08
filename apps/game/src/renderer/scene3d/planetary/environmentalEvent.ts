// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/environmentalEvent.ts - 10.G G1-G2 Continuous Environmental Event + Weather Accumulation: CLEAR->PRE->STORM->LANDING->POST->RECOVERY + WET->DRAINING->DRYING.

// Wired via planetary/wireG — ticked per frame from EnvironmentalContext.

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type EventPhase = "clear" | "pre" | "storm" | "landing" | "post" | "recovery";

export interface EnvironmentalEvent {
  eventId: string;
  phase: EventPhase;
  startedAt: number;
  updatedAt: number;
  weatherKind: "clear" | "overcast" | "rain" | "storm";
  windSpeed: number;
  intensity: number;
  puddle: number;
  vegetationWet: number;
  mist: number;
  drainage: number;
}

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

export function deriveEnvironmentalEvent(ctx: EnvironmentalContext, now: number, prev: EnvironmentalEvent | null): EnvironmentalEvent {
  const kind = ctx.weather.kind;
  const wind = ctx.wind.speed;
  const intensity = ctx.weather.precipitationIntensity;
  const isLanding = (ctx.vesselState?.altitude ?? 9999) < 180 && (ctx.vesselState?.velocity ? Math.hypot(ctx.vesselState.velocity.x, ctx.vesselState.velocity.z) < 40 : false);
  let phase: EventPhase = prev?.phase ?? "clear";
  const age = prev ? now - prev.startedAt : 0;
  if (kind === "clear" && intensity < 0.06) {
    if (prev?.phase === "storm") phase = "post";
    else if (prev?.phase === "post" && age > 45000) phase = "recovery";
    else if (prev?.phase === "recovery" && age > 180000) phase = "clear";
    else if (prev?.phase !== "post" && prev?.phase !== "recovery") phase = "clear";
  } else if (kind === "overcast" && wind > 6.2 && intensity < 0.18) {
    phase = "pre";
  } else if (kind === "rain" || kind === "storm") {
    phase = isLanding ? "landing" : "storm";
  }
  if (prev?.phase === "landing" && !isLanding && phase !== "storm") phase = "post";
  let puddle = prev?.puddle ?? 0;
  if (phase === "storm" || phase === "landing") puddle = clamp01(puddle + intensity * 0.022);
  else if (phase === "post") puddle = clamp01(puddle - 0.006);
  else if (phase === "recovery") puddle = clamp01(puddle - 0.011);
  else puddle = clamp01(puddle - 0.003);
  const drainage = phase === "post" ? 0.28 + puddle * 0.42 : phase === "recovery" ? 0.12 + puddle * 0.22 : 0;
  const vegetationWet = clamp01(puddle * 0.58 + intensity * 0.42 + (phase === "post" ? 0.12 : 0));
  const mist = phase === "post" ? clamp01(puddle * 0.48 + 0.18) : phase === "recovery" ? puddle * 0.32 : phase === "landing" ? 0.22 + intensity * 0.28 : 0;
  const eventId = prev?.eventId ?? `evt-${ctx.planetId}-${Math.floor(now / 60000)}`;
  const startedAt = prev && prev.phase === phase ? prev.startedAt : now;
  return { eventId, phase, startedAt, updatedAt: now, weatherKind: kind, windSpeed: wind, intensity, puddle, vegetationWet, mist, drainage };
}

export function tickEnvironmentalEvent(prev: EnvironmentalEvent, ctx: EnvironmentalContext, now: number, dt: number): EnvironmentalEvent {
  const derived = deriveEnvironmentalEvent(ctx, now, prev);
  const lerp = 1 - Math.exp(-dt * 1.8);
  return {
    ...derived,
    puddle: prev.puddle + (derived.puddle - prev.puddle) * lerp,
    vegetationWet: prev.vegetationWet + (derived.vegetationWet - prev.vegetationWet) * lerp,
    mist: prev.mist + (derived.mist - prev.mist) * lerp,
    drainage: prev.drainage + (derived.drainage - prev.drainage) * lerp,
  };
}

export function isPostStorm(event: EnvironmentalEvent): boolean {
  return event.phase === "post" || event.phase === "recovery";
}

export function isWetSurface(event: EnvironmentalEvent): boolean {
  return event.puddle > 0.18 || event.vegetationWet > 0.32;
}
