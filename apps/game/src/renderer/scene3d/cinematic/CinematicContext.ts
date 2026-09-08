// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// cinematic/CinematicContext.ts - 10.C.1 presentation contracts.
// A CinematicContext is derived per active event from authority state and
// never persists: cameras, exposure, vessel motion, and audio levels follow
// it, gameplay never reads it back. All cinematic motion stays bounded so
// player control is never overridden.

import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type CinematicEventType =
  | "ATMOSPHERIC_ENTRY"
  | "STORM"
  | "LIGHTNING"
  | "EMERGENCY_LANDING"
  | "LANDING"
  | "CRASH"
  | "DOCKING";

export type CinematicPhase = "TRIGGER" | "PRE" | "ACTIVE" | "PEAK" | "RECOVERY" | "EXIT";

export type CinematicCameraMode =
  | "stable"
  | "follow"
  | "cloud_compression"
  | "reveal"
  | "approach"
  | "touchdown"
  | "impact"
  | "displace"
  | "settle";

export interface CinematicContext {
  eventId: string;
  eventType: CinematicEventType;
  phase: CinematicPhase;
  priority: number;
  cameraMode: CinematicCameraMode;
  exposure: number; // additive stops, hard-capped at EXPOSURE_MAX
  visibility: number; // meters
  environmentalIntensity: number; // 0..1
  audioIntensity: number; // 0..1
  vesselMotion: { pitch: number; roll: number; vibration: number }; // degrees, bounded
  transitionProgress: number; // 0..1 within current phase
  exitCondition: string;
}

/** Event priority: higher preempts lower, never interrupts CRASH. */
export const EVENT_PRIORITY: Record<CinematicEventType, number> = {
  CRASH: 100,
  EMERGENCY_LANDING: 90,
  ATMOSPHERIC_ENTRY: 70,
  LIGHTNING: 65,
  STORM: 50,
  LANDING: 45,
  DOCKING: 30,
};

/** Hard presentation bounds — cinematic layer may never exceed these. */
export const MOTION_MAX_DEG = 2;
export const EXPOSURE_MAX = 0.3;

/** Camera grammar per event: each phase names its shot, never a cutscene. */
const CAMERA_GRAMMAR: Record<CinematicEventType, Record<CinematicPhase, CinematicCameraMode>> = {
  ATMOSPHERIC_ENTRY: { TRIGGER: "stable", PRE: "follow", ACTIVE: "cloud_compression", PEAK: "cloud_compression", RECOVERY: "reveal", EXIT: "stable" },
  STORM: { TRIGGER: "stable", PRE: "follow", ACTIVE: "follow", PEAK: "follow", RECOVERY: "reveal", EXIT: "stable" },
  LIGHTNING: { TRIGGER: "stable", PRE: "stable", ACTIVE: "reveal", PEAK: "reveal", RECOVERY: "stable", EXIT: "stable" },
  EMERGENCY_LANDING: { TRIGGER: "follow", PRE: "approach", ACTIVE: "approach", PEAK: "touchdown", RECOVERY: "settle", EXIT: "stable" },
  LANDING: { TRIGGER: "follow", PRE: "approach", ACTIVE: "approach", PEAK: "touchdown", RECOVERY: "settle", EXIT: "stable" },
  CRASH: { TRIGGER: "follow", PRE: "follow", ACTIVE: "impact", PEAK: "displace", RECOVERY: "settle", EXIT: "stable" },
  DOCKING: { TRIGGER: "follow", PRE: "approach", ACTIVE: "approach", PEAK: "touchdown", RECOVERY: "settle", EXIT: "stable" },
};

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Derive a context snapshot. eventId must be stable for the event lifetime
 * (the director assigns it once); `tick` is only a fallback seed.
 */
export function deriveCinematicContext(
  envCtx: EnvironmentalContext,
  eventType: CinematicEventType,
  phase: CinematicPhase,
  tick: number,
  eventId?: string,
): CinematicContext {
  const envIntensity = clamp01(
    envCtx.weather.precipitationIntensity * 0.5 +
      envCtx.wind.speed * 0.05 +
      (1 - envCtx.atmosphere.visibility / 10000) * 0.3,
  );
  const peakBoost = phase === "PEAK" ? 1 : 0;
  const exposure = Math.min(EXPOSURE_MAX, envIntensity * 0.25 + peakBoost * 0.15);
  return {
    eventId: eventId ?? `cin-${eventType}-${tick}`,
    eventType,
    phase,
    priority: EVENT_PRIORITY[eventType] ?? 50,
    cameraMode: CAMERA_GRAMMAR[eventType][phase],
    exposure,
    visibility: envCtx.atmosphere.visibility,
    environmentalIntensity: envIntensity,
    audioIntensity: clamp01(envIntensity * 0.8 + peakBoost * 0.2),
    vesselMotion: {
      pitch: Math.min(MOTION_MAX_DEG, envIntensity * 1.2),
      roll: Math.min(MOTION_MAX_DEG, envIntensity * 0.9),
      vibration: Math.min(1, envIntensity * 0.6),
    },
    transitionProgress: phase === "TRIGGER" ? 0 : phase === "EXIT" ? 1 : 0.5,
    exitCondition: phase === "EXIT" ? "completed" : "ongoing",
  };
}
