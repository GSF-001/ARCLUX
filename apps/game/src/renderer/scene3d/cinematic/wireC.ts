// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// cinematic/wireC.ts - 10.C single wiring point (C1-C10).
// Core (C1-C5): event director, flight turbulence, heat response, camera
// director. Response (C6-C10): audio, cockpit, impact, facility discovery,
// budget — fed by the core's live context and turbulence instead of nulls.
// Triggers derive from authority state each tick. Presentation only: never
// touches gameplay state.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";
import type { VesselState } from "../../../../../../packages/gameserver/vesselState";
import type { CinematicContext } from "./CinematicContext";
import { CinematicEventDirector } from "./CinematicEventDirector";
import {
  resolveAtmosphericFlight,
  type FlightTurbulence,
} from "./AtmosphericFlightResolver";
import {
  resolveHeatResponse,
  type HeatPhase,
  type HeatResponse,
} from "./HeatResponseResolver";
import {
  directCinematicCamera,
  type CameraOffsets,
} from "./CinematicCameraDirector";
import {
  deriveAudioState,
  tickAudioState,
  type AudioState,
} from "./EnvironmentalAudioResolver";
import {
  deriveCockpitState,
  tickCockpit,
  type CockpitState,
} from "./CockpitResponseResolver";
import {
  createImpact,
  tickImpact,
  createImpactSystem,
  updateImpactSystem,
  type ImpactState,
  type ImpactSystem,
} from "./ImpactPresentation";
import {
  deriveDiscoveryState,
  createDiscoverySystem,
  tickDiscovery,
  type DiscoveryState,
  type DiscoverySystem,
} from "./FacilityDiscovery";
import { deriveBudgetState, type BudgetState } from "./CinematicBudget";
import type { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { CockpitOverlay } from "../../cockpitOverlay";
import { updateCockpitGradePass } from "../cockpitGradePass";

export interface CinematicCTickOpts {
  timeSec: number; // deterministic clock
  altitude: number; // meters above surface
  vesselSpeed: number; // m/s
  vesselState?: VesselState; // authoritative emergency flag
  camera?: THREE.Camera | null;
  cameraPosXZ?: { x: number; z: number };
  anchor?: { x: number; z: number };
  distanceToLightning?: number;
  renderer?: THREE.WebGLRenderer;
  /** 10.V U4: wireC = satu-satunya sumber update presentasi kokpit. */
  cockpitPass?: ShaderPass | null;
  cockpitOverlay?: CockpitOverlay | null;
  hudRoot?: HTMLElement | null;
  cockpitDroplets?: boolean;
}

export interface CinematicCFrame {
  active: CinematicContext | null;
  flight: FlightTurbulence;
  heat: HeatResponse;
  offsets: CameraOffsets;
}

export interface CinematicC {
  director: CinematicEventDirector;
  flight: FlightTurbulence | null;
  flightPhase: FlightTurbulence["phase"];
  heatPhase: HeatPhase;
  heatValue: number;
  shake: number;
  prevAltitude: number | null;
  prevVesselState: VesselState | null;
  audio: AudioState;
  cockpit: CockpitState;
  impacts: Map<string, { state: ImpactState; sys: ImpactSystem }>;
  discoveries: Map<string, { state: DiscoveryState; sys: DiscoverySystem }>;
  budget: BudgetState | null;
}

const ENTRY_ALTITUDE = 2500;
const ENTRY_SPEED = 40;
const LANDING_ALTITUDE = 50;

/** Build all cinematic state. No scene objects owned by the core. */
export function createCinematicC(): CinematicC {
  return {
    director: new CinematicEventDirector(),
    flight: null,
    flightPhase: "NORMAL",
    heatPhase: "COLD",
    heatValue: 0,
    shake: 0,
    prevAltitude: null,
    prevVesselState: null,
    audio: { windGain: 0.12, windPitch: 1, rainGain: 0, rainPitch: 1, thunderGain: 0, thunderDelay: 0, engineGain: 0.18, enginePitch: 1, atmosphereGain: 0.08, masterGain: 0.62 },
    cockpit: { windshieldWet: 0, dropletOpacity: 0, flashIntensity: 0, heatVignette: 0, cloudDim: 0, hudShake: { x: 0, y: 0 }, exposureOffset: 0 },
    impacts: new Map(),
    discoveries: new Map(),
    budget: null,
  };
}

function updateTriggers(
  sys: CinematicC,
  env: EnvironmentalContext,
  nowMs: number,
  altitude: number,
  vesselSpeed: number,
  vesselState: VesselState | undefined,
): void {
  if (env.weather.kind === "storm") {
    if (!sys.director.has("STORM")) sys.director.trigger(env, "STORM", nowMs);
  } else {
    sys.director.cancel("STORM");
  }

  if (vesselState && vesselState !== sys.prevVesselState) {
    if (vesselState === "falling" && !sys.director.has("EMERGENCY_LANDING")) {
      sys.director.trigger(env, "EMERGENCY_LANDING", nowMs);
    }
    if (vesselState === "crashed" && !sys.director.has("CRASH")) {
      sys.director.trigger(env, "CRASH", nowMs, 10000);
    }
  }
  sys.prevVesselState = vesselState ?? null;

  if (sys.prevAltitude !== null) {
    const wasAboveEntry = sys.prevAltitude > ENTRY_ALTITUDE;
    if (wasAboveEntry && altitude <= ENTRY_ALTITUDE && vesselSpeed > ENTRY_SPEED) {
      if (!sys.director.has("ATMOSPHERIC_ENTRY")) sys.director.trigger(env, "ATMOSPHERIC_ENTRY", nowMs);
    }
    const wasAboveGround = sys.prevAltitude >= LANDING_ALTITUDE;
    if (wasAboveGround && altitude < LANDING_ALTITUDE && vesselSpeed < 25) {
      if (!sys.director.has("LANDING")) sys.director.trigger(env, "LANDING", nowMs, 6000);
    }
  }
  sys.prevAltitude = altitude;
}

/**
 * Advance the full cinematic layer one frame: core first, then the response
 * systems fed by the core's live context and turbulence.
 */
export function tickCinematicC(
  sys: CinematicC,
  scene: THREE.Scene,
  env: EnvironmentalContext,
  dt: number,
  opts: CinematicCTickOpts,
): CinematicCFrame {
  const nowMs = opts.timeSec * 1000;
  updateTriggers(sys, env, nowMs, opts.altitude, opts.vesselSpeed, opts.vesselState);

  const active = sys.director.tick(env, nowMs);

  const flight = resolveAtmosphericFlight(
    env,
    opts.altitude,
    opts.vesselSpeed,
    sys.flightPhase,
    dt,
    opts.timeSec,
    sys.flight ?? undefined,
  );
  sys.flight = flight;
  sys.flightPhase = flight.phase;

  const heat = resolveHeatResponse(
    opts.vesselSpeed,
    env.atmosphere.density,
    opts.altitude,
    sys.heatPhase,
    sys.heatValue,
    dt,
  );
  sys.heatPhase = heat.phase;
  sys.heatValue = heat.heat;

  const offsets = directCinematicCamera(active, flight, dt, opts.timeSec, sys.shake);
  sys.shake = offsets.shake;

  if (opts.camera) {
    opts.camera.rotation.x += (offsets.pitchDeg * Math.PI) / 180;
    opts.camera.rotation.z += (offsets.rollDeg * Math.PI) / 180;
  }
  if (opts.renderer) {
    opts.renderer.toneMappingExposure = opts.renderer.toneMappingExposure + offsets.exposure;
  }

  // Response layer (C6-C10) fed by live core output.
  const distLightning = opts.distanceToLightning ?? 2800;
  sys.audio = tickAudioState(
    sys.audio,
    deriveAudioState(env, active, { distanceToLightning: distLightning, vesselVelocity: opts.vesselSpeed, dt }),
    dt,
  );
  sys.cockpit = tickCockpit(
    sys.cockpit,
    deriveCockpitState(env, active, flight, distLightning, dt, opts.timeSec),
    dt,
  );
  // 10.V U4: lima output mati kini hidup — SATU sumber update (wireC).
  // Urutan akumulasi aman: wireX sudah set base exposure absolut tiap
  // frame SEBELUM tick ini (index.ts), jadi += di sini tidak drift.
  if (opts.cockpitPass && opts.cockpitPass.enabled) {
    updateCockpitGradePass(opts.cockpitPass, sys.cockpit);
  }
  if (opts.renderer) {
    opts.renderer.toneMappingExposure = opts.renderer.toneMappingExposure + sys.cockpit.exposureOffset;
  }
  if (opts.cockpitOverlay) {
    opts.cockpitOverlay.tick(
      { dropletOpacity: sys.cockpit.dropletOpacity, flashIntensity: sys.cockpit.flashIntensity },
      opts.timeSec,
      {
        gradePassActive: opts.cockpitPass?.enabled ?? false,
        dropletsEnabled: opts.cockpitDroplets ?? true,
      },
    );
  }
  if (opts.hudRoot) {
    // Shake DOM ±3px jepit (gratis, compositor; tidak berantem kamera).
    const sx = Math.max(-3, Math.min(3, sys.cockpit.hudShake.x));
    const sy = Math.max(-3, Math.min(3, sys.cockpit.hudShake.y));
    opts.hudRoot.style.transform = `translate3d(${sx.toFixed(2)}px,${sy.toFixed(2)}px,0)`;
  }
  for (const [id, entry] of sys.impacts) {
    entry.state = tickImpact(entry.state, nowMs, dt);
    updateImpactSystem(entry.sys, entry.state, dt);
    if (entry.state.phase === "WRECK" && nowMs - entry.state.startedAt > 6200) {
      scene.remove(entry.sys.debris);
      scene.remove(entry.sys.smoke);
      scene.remove(entry.sys.flash);
      sys.impacts.delete(id);
    }
  }
  for (const [id, entry] of sys.discoveries) {
    tickDiscovery(entry.sys, entry.state, dt);
    void id;
  }
  const camX = opts.cameraPosXZ?.x ?? 0;
  const camZ = opts.cameraPosXZ?.z ?? 0;
  const anchX = opts.anchor?.x ?? 0;
  const anchZ = opts.anchor?.z ?? 0;
  const dist = Math.hypot(camX - anchX, camZ - anchZ);
  sys.budget = deriveBudgetState(dist, 0.22, sys.audio.masterGain * 0.42 + sys.cockpit.cloudDim * 0.18, active?.priority ?? 30);

  return { active, flight, heat, offsets };
}

/** Register a world impact (wreck flash + debris + smoke). */
export function triggerCinematicImpact(
  sys: CinematicC,
  scene: THREE.Scene,
  id: string,
  pos: { x: number; y: number; z: number },
  intensity: number,
  now: number,
): void {
  const state = createImpact(id, pos, intensity, now);
  const isys = createImpactSystem(pos);
  scene.add(isys.debris);
  scene.add(isys.smoke);
  scene.add(isys.wreck);
  scene.add(isys.flash);
  sys.impacts.set(id, { state, sys: isys });
}

/** Register or refresh a facility discovery beacon. */
export function ensureCinematicDiscovery(
  sys: CinematicC,
  scene: THREE.Scene,
  facilityId: string,
  facilityPos: { x: number; z: number },
  cameraPos: { x: number; z: number },
  env: EnvironmentalContext,
): DiscoveryState {
  const entry = sys.discoveries.get(facilityId);
  const state = deriveDiscoveryState(facilityId, facilityPos, cameraPos, env, entry?.state ?? null);
  if (!entry) {
    const dsys = createDiscoverySystem({ x: facilityPos.x, y: 0, z: facilityPos.z });
    scene.add(dsys.beacon);
    scene.add(dsys.runway);
    scene.add(dsys.silhouette);
    sys.discoveries.set(facilityId, { state, sys: dsys });
  } else {
    entry.state = state;
  }
  return state;
}

/** Clear all events and response state (scene dispose / region handoff). */
export function disposeCinematicC(scene: THREE.Scene, sys: CinematicC): void {
  for (const [, entry] of sys.impacts) {
    scene.remove(entry.sys.debris);
    scene.remove(entry.sys.smoke);
    scene.remove(entry.sys.wreck);
    scene.remove(entry.sys.flash);
  }
  sys.impacts.clear();
  for (const [, entry] of sys.discoveries) {
    scene.remove(entry.sys.beacon);
    scene.remove(entry.sys.runway);
    scene.remove(entry.sys.silhouette);
  }
  sys.discoveries.clear();
  sys.director = new CinematicEventDirector();
  sys.flight = null;
  sys.flightPhase = "NORMAL";
  sys.heatPhase = "COLD";
  sys.heatValue = 0;
  sys.shake = 0;
  sys.prevAltitude = null;
  sys.prevVesselState = null;
}
