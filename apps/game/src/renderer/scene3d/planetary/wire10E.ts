// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/wire10E.ts - 10.E single wiring point.
// Renders the authoritative emergency flag from each vessel snapshot
// (ADRIFT pulse, FALLING heat, LANDING dust phases, CRASHED smoke).
// State comes from the server; the client only positions and animates.
// Visual-only: reads authority state, never writes it.

import * as THREE from "three";
import type { VesselEntity } from "../../../../../../packages/gameserver/types";
import {
  hullOf,
  ADRIFT_BELOW,
  type VesselState,
} from "../../../../../../packages/gameserver/vesselState";
import {
  createEmergencyVisuals,
  tickEmergency,
  type EmergencySystem,
} from "./emergencyLanding";

export interface Emergency10X {
  visuals: EmergencySystem;
}

/** Build visuals once and attach to the scene. */
export function createEmergency10X(scene: THREE.Scene): Emergency10X {
  const visuals = createEmergencyVisuals();
  scene.add(visuals.group);
  return { visuals };
}

/**
 * Effective display state: authoritative snapshot flag first, hull-derived
 * fallback when the flag is absent (e.g. older snapshots).
 */
export function emergencyDisplayState(vessel: VesselEntity | undefined): VesselState {
  if (!vessel) return "nominal";
  if (vessel.emergency) return vessel.emergency.state;
  return hullOf(vessel.vessel) < ADRIFT_BELOW ? "adrift" : "nominal";
}

/**
 * Position visuals on the vessel and advance one frame. Returns the display
 * state so callers (HUD) can reflect ENGINE status without recomputing.
 */
export function tickEmergency10X(
  sys: Emergency10X,
  vessel: VesselEntity | undefined,
  localPos: { x: number; y: number; z: number },
  dt: number,
  timeSec: number,
  wind: { direction: number; speed: number },
): VesselState {
  const state = emergencyDisplayState(vessel);
  sys.visuals.group.visible = state !== "nominal";
  if (state === "nominal") {
    tickEmergency(sys.visuals, state, dt, timeSec);
    return state;
  }
  sys.visuals.group.position.set(localPos.x, localPos.y, localPos.z);
  tickEmergency(sys.visuals, state, dt, timeSec, { windDirection: wind.direction, windSpeed: wind.speed });
  return state;
}

/** Detach from the scene and free GPU resources. */
export function disposeEmergency10X(scene: THREE.Scene, sys: Emergency10X): void {
  scene.remove(sys.visuals.group);
  sys.visuals.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
  });
}
