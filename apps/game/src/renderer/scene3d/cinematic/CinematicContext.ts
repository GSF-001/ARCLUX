// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// cinematic/CinematicContext.ts - 10.C CinematicContext derived, gak persist: eventId/eventType/phase/priority/cameraMode/exposure/visibility/vesselMotion. Zoom dari blueprint 10.C core.

// WIRE NOTE for SESSION 2: import { deriveCinematicContext } from "./cinematic/CinematicContext" di scene3d/index.ts. Derive per frame dari EnvironmentalContext + event.

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type CinematicEventType = "ATMOSPHERIC_ENTRY" | "STORM" | "LIGHTNING" | "EMERGENCY_LANDING" | "LANDING" | "CRASH" | "DOCKING";

export type CinematicPhase = "TRIGGER" | "PRE" | "ACTIVE" | "PEAK" | "RECOVERY" | "EXIT";

export interface CinematicContext {
  eventId: string;
  eventType: CinematicEventType;
  phase: CinematicPhase;
  priority: number; // CRASH 100 > EMERGENCY 90 > ENTRY 70 > STORM 50
  cameraMode: "stable" | "follow" | "cloud_compression" | "reveal" | "touchdown" | "displace";
  exposure: number; // 0..1 (+0.3 max)
  visibility: number; // m
  environmentalIntensity: number; // 0..1
  audioIntensity: number; // 0..1
  vesselMotion: { pitch: number; roll: number; vibration: number }; // deg, bounded <=2deg
  transitionProgress: number; // 0..1
  exitCondition: string;
}

export function deriveCinematicContext(
  envCtx: EnvironmentalContext,
  eventType: CinematicEventType,
  phase: CinematicPhase,
  tick: number,
): CinematicContext {
  const priorityMap: Record<CinematicEventType, number> = {
    CRASH: 100,
    EMERGENCY_LANDING: 90,
    ATMOSPHERIC_ENTRY: 70,
    LIGHTNING: 65,
    STORM: 50,
    LANDING: 45,
    DOCKING: 30,
  };
  const priority = priorityMap[eventType] ?? 50;
  const envIntensity = envCtx.weather.precipitationIntensity * 0.5 + envCtx.wind.speed * 0.05 + (1 - envCtx.atmosphere.visibility / 10000) * 0.3;
  const exposure = Math.min(0.3, envIntensity * 0.25 + (phase === "PEAK" ? 0.15 : 0));
  const vesselMotion = {
    pitch: Math.min(2, envIntensity * 1.2),
    roll: Math.min(2, envIntensity * 0.9),
    vibration: Math.min(1, envIntensity * 0.6),
  };
  return {
    eventId: `cin-${eventType}-${tick}`,
    eventType,
    phase,
    priority,
    cameraMode: phase === "PEAK" ? "reveal" : phase === "ACTIVE" ? "follow" : "stable",
    exposure,
    visibility: envCtx.atmosphere.visibility,
    environmentalIntensity: envIntensity,
    audioIntensity: Math.min(1, envIntensity * 0.8 + (phase === "PEAK" ? 0.2 : 0)),
    vesselMotion,
    transitionProgress: phase === "TRIGGER" ? 0 : phase === "EXIT" ? 1 : 0.5,
    exitCondition: phase === "EXIT" ? "completed" : "ongoing",
  };
}
