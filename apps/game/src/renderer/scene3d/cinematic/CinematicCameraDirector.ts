// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// cinematic/CinematicCameraDirector.ts - 10.C.5 bounded camera response.
// Converts the winning cinematic context plus live turbulence into small
// additive camera offsets. Offsets are applied AFTER the player camera
// update and stay within hard bounds, so control is never taken away:
// no forced cutscenes, no snaps, decaying shake that always settles.

import type { CinematicContext, CinematicCameraMode } from "./CinematicContext";
import { MOTION_MAX_DEG, EXPOSURE_MAX } from "./CinematicContext";
import type { FlightTurbulence } from "./AtmosphericFlightResolver";

export interface CameraOffsets {
  pitchDeg: number; // additive, bounded to +/-MOTION_MAX_DEG
  rollDeg: number; // additive, bounded to +/-MOTION_MAX_DEG
  exposure: number; // additive stops, bounded to EXPOSURE_MAX
  shake: number; // 0..1 decayed shake energy
}

const MODE_PITCH: Record<CinematicCameraMode, number> = {
  stable: 0,
  follow: -0.4,
  cloud_compression: -0.9,
  reveal: 0.6,
  approach: -0.5,
  touchdown: -1.1,
  impact: 1.2,
  displace: 1.6,
  settle: 0.2,
};

const MODE_ROLL: Record<CinematicCameraMode, number> = {
  stable: 0,
  follow: 0.2,
  cloud_compression: 0.3,
  reveal: -0.2,
  approach: 0.2,
  touchdown: 0.4,
  impact: -0.8,
  displace: -1.1,
  settle: 0,
};

const NO_EVENT: CameraOffsets = { pitchDeg: 0, rollDeg: 0, exposure: 0, shake: 0 };

/**
 * Direct the camera for one frame. Blends the shot grammar with live
 * turbulence shake; shake energy decays so every event settles to stable.
 */
export function directCinematicCamera(
  active: CinematicContext | null,
  turbulence: FlightTurbulence | null,
  dt: number,
  timeSec: number,
  prevShake = 0,
): CameraOffsets {
  if (!active) {
    const decayed = prevShake * Math.max(0, 1 - dt * 2);
    return { ...NO_EVENT, shake: decayed < 0.01 ? 0 : decayed };
  }
  const progress = Math.min(1, Math.max(0, active.transitionProgress));
  const envelope = Math.sin(progress * Math.PI); // 0 at edges, 1 mid-shot
  const shakeTarget = Math.min(1, (turbulence?.cameraShake ?? 0) * 0.7 + active.environmentalIntensity * 0.3);
  const k = Math.min(1, dt * 3);
  const shake = prevShake + (shakeTarget * envelope - prevShake) * k;
  const shimmerP = Math.sin(timeSec * 7.3) * shake * 0.3;
  const shimmerR = Math.cos(timeSec * 8.1) * shake * 0.3;
  const pitchDeg = Math.max(
    -MOTION_MAX_DEG,
    Math.min(MOTION_MAX_DEG, MODE_PITCH[active.cameraMode] * envelope + shimmerP),
  );
  const rollDeg = Math.max(
    -MOTION_MAX_DEG,
    Math.min(MOTION_MAX_DEG, MODE_ROLL[active.cameraMode] * envelope + shimmerR),
  );
  return {
    pitchDeg,
    rollDeg,
    exposure: Math.min(EXPOSURE_MAX, active.exposure),
    shake,
  };
}
