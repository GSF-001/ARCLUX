// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// cinematic/wireC6C10.ts - 10.C6-C10 single wiring point.
// Owns Audio, Cockpit, Impact, FacilityDiscovery, Budget systems and advances them
// from EnvironmentalContext + CinematicContext + turbulence. Visual-only.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";
import type { CinematicContext } from "./CinematicContext";
import type { FlightTurbulence } from "./AtmosphericFlightResolver";
import { deriveAudioState, tickAudioState, type AudioState } from "./EnvironmentalAudioResolver";
import { deriveCockpitState, tickCockpit, type CockpitState } from "./CockpitResponseResolver";
import { createImpact, tickImpact, createImpactSystem, updateImpactSystem, type ImpactState, type ImpactSystem } from "./ImpactPresentation";
import { deriveDiscoveryState, createDiscoverySystem, tickDiscovery, type DiscoveryState, type DiscoverySystem } from "./FacilityDiscovery";
import { deriveBudgetState, type BudgetState } from "./CinematicBudget";

export interface CinematicC6C10TickOpts {
  timeSec: number;
  cinematic: CinematicContext | null;
  turbulence: FlightTurbulence | null;
  distanceToLightning: number;
  vesselVelocity: number;
  cameraPos: { x: number; z: number };
  anchor: { x: number; z: number };
  dt: number;
}

export interface CinematicC6C10 {
  audio: AudioState;
  cockpit: CockpitState;
  impacts: Map<string, { state: ImpactState; sys: ImpactSystem }>;
  discoveries: Map<string, { state: DiscoveryState; sys: DiscoverySystem }>;
  budget: BudgetState | null;
}

export function createCinematicC6C10(): CinematicC6C10 {
  return {
    audio: { windGain: 0.12, windPitch: 1, rainGain: 0, rainPitch: 1, thunderGain: 0, thunderDelay: 0, engineGain: 0.18, enginePitch: 1, atmosphereGain: 0.08, masterGain: 0.62 },
    cockpit: { windshieldWet: 0, dropletOpacity: 0, flashIntensity: 0, heatVignette: 0, cloudDim: 0, hudShake: { x: 0, y: 0 }, exposureOffset: 0 },
    impacts: new Map(),
    discoveries: new Map(),
    budget: null,
  };
}

export function tickCinematicC6C10(
  sys: CinematicC6C10,
  scene: THREE.Scene,
  env: EnvironmentalContext,
  opts: CinematicC6C10TickOpts,
): void {
  const nextAudio = deriveAudioState(env, opts.cinematic, { distanceToLightning: opts.distanceToLightning, vesselVelocity: opts.vesselVelocity, dt: opts.dt });
  sys.audio = tickAudioState(sys.audio, nextAudio, opts.dt);
  const nextCockpit = deriveCockpitState(env, opts.cinematic, opts.turbulence, opts.distanceToLightning, opts.dt);
  sys.cockpit = tickCockpit(sys.cockpit, nextCockpit, opts.dt);
  for (const [id, entry] of sys.impacts) {
    entry.state = tickImpact(entry.state, opts.timeSec * 1000, opts.dt);
    updateImpactSystem(entry.sys, entry.state, opts.dt);
    if (entry.state.phase === "WRECK" && opts.timeSec * 1000 - entry.state.startedAt > 6200) {
      scene.remove(entry.sys.debris);
      scene.remove(entry.sys.smoke);
      scene.remove(entry.sys.flash);
      sys.impacts.delete(id);
    }
  }
  for (const [id, entry] of sys.discoveries) {
    tickDiscovery(entry.sys, entry.state, opts.dt);
    void id;
  }
  const dist = Math.hypot(opts.cameraPos.x - opts.anchor.x, opts.cameraPos.z - opts.anchor.z);
  const volCost = 0.22;
  const effCost = sys.audio.masterGain * 0.42 + sys.cockpit.cloudDim * 0.18;
  const priority = opts.cinematic?.priority ?? 30;
  sys.budget = deriveBudgetState(dist, volCost, effCost, priority);
}

export function triggerImpact(sys: CinematicC6C10, scene: THREE.Scene, id: string, pos: { x: number; y: number; z: number }, intensity: number, now: number): void {
  const state = createImpact(id, pos, intensity, now);
  const isys = createImpactSystem(pos);
  scene.add(isys.debris);
  scene.add(isys.smoke);
  scene.add(isys.wreck);
  scene.add(isys.flash);
  sys.impacts.set(id, { state, sys: isys });
}

export function ensureDiscovery(
  sys: CinematicC6C10,
  scene: THREE.Scene,
  facilityId: string,
  facilityPos: { x: number; z: number },
  cameraPos: { x: number; z: number },
  env: EnvironmentalContext,
): DiscoveryState {
  let entry = sys.discoveries.get(facilityId);
  const state = deriveDiscoveryState(facilityId, facilityPos, cameraPos, env, entry?.state ?? null);
  if (!entry) {
    const dsys = createDiscoverySystem({ x: facilityPos.x, y: 0, z: facilityPos.z });
    scene.add(dsys.beacon);
    scene.add(dsys.runway);
    scene.add(dsys.silhouette);
    entry = { state, sys: dsys };
    sys.discoveries.set(facilityId, entry);
  } else {
    entry.state = state;
  }
  return state;
}

export function disposeCinematicC6C10(scene: THREE.Scene, sys: CinematicC6C10): void {
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
}
