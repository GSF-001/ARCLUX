// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/wireG.ts - 10.G Gaps Closed single wiring point.
// Owns EnvironmentalEvent, Coastal, Hydrological, Atmospheric Continuity systems
// and advances them from the one EnvironmentalContext. Visual-only.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";
import type { VesselEntity } from "../../../../../../packages/gameserver/types";
import { deriveEnvironmentalEvent, tickEnvironmentalEvent, type EnvironmentalEvent } from "./environmentalEvent";
import { getCoastalZone, createCoastalSystem, tickCoastal, type CoastalSystem } from "./coastal";
import { getRiverFlow, createRiverSystem, tickRiver, type RiverSystem } from "./hydrological";
import { deriveAtmosphericContinuity, tickAtmosphere, tickTerrainShadows, createShadowPlane, type AtmosphericContinuity } from "./atmosphericContinuity";

export interface Planetary10GTickOpts {
  timeSec: number;
  anchor: { x: number; z: number };
  cameraPos: { x: number; y: number; z: number };
  altitude: number;
  vessel?: VesselEntity;
}

export interface Planetary10G {
  event: EnvironmentalEvent | null;
  coastal: CoastalSystem;
  river: RiverSystem;
  shadowPlane: THREE.Mesh;
  continuity: AtmosphericContinuity | null;
  fog: THREE.FogExp2 | null;
}

export function createPlanetary10G(scene: THREE.Scene): Planetary10G {
  const coastal = createCoastalSystem();
  const river = createRiverSystem();
  const shadowPlane = createShadowPlane();
  scene.add(shadowPlane);
  coastal.foamMeshes.forEach(m => scene.add(m));
  scene.add(coastal.mistPoints);
  scene.add(coastal.shallowPlane);
  river.flowMeshes.forEach(m => scene.add(m));
  scene.add(river.waterfallPoints);
  const fog = (scene as any).fog as THREE.FogExp2 | undefined ?? null;
  return { event: null, coastal, river, shadowPlane, continuity: null, fog: fog ?? null };
}

export function tickPlanetary10G(sys: Planetary10G, scene: THREE.Scene, env: EnvironmentalContext, dt: number, opts: Planetary10GTickOpts): void {
  const now = opts.timeSec * 1000;
  const prev = sys.event;
  const next = prev ? tickEnvironmentalEvent(prev, env, now, dt) : deriveEnvironmentalEvent(env, now, null);
  sys.event = next;
  const cont = deriveAtmosphericContinuity(env, opts.altitude, env.sun.elevation);
  sys.continuity = cont;
  const fog = (scene as any).fog as THREE.FogExp2 | undefined ?? sys.fog;
  if (fog) {
    const fsys = { fog } as { fog: THREE.FogExp2 };
    tickAtmosphere(fsys, cont, dt);
    sys.fog = fog;
  }
  tickTerrainShadows(sys.shadowPlane, cont, env.sun.direction);
  const height = env.terrain.height;
  const slope = env.terrain.slope;
  const distToCoast = Math.abs(height) * 18 + (env.ocean.depth < -4 ? 12 : 180);
  const zone = getCoastalZone(height, distToCoast, slope);
  const isStorm = env.weather.kind === "storm" || next.phase === "storm" || next.phase === "landing";
  tickCoastal(sys.coastal, zone, distToCoast, isStorm, env.wind.speed, env.wind.direction, dt);
  const neighbors = [height + 2, height - 3, height + 1, height - 1, height + 1.2, height - 0.8, height + 0.5, height - 2.2];
  const flow = getRiverFlow(height, slope, neighbors);
  const isRaining = env.weather.kind === "rain" || env.weather.kind === "storm" || next.puddle > 0.18;
  tickRiver(sys.river, flow, isRaining, dt);
  sys.coastal.shallowPlane.position.set(opts.anchor.x, -0.9, opts.anchor.z);
  sys.river.flowMeshes.forEach((m, i) => {
    m.position.x = opts.anchor.x + Math.cos(env.wind.direction + i) * 18;
    m.position.z = opts.anchor.z + Math.sin(env.wind.direction + i) * 18;
  });
}

export function disposePlanetary10G(scene: THREE.Scene, sys: Planetary10G): void {
  scene.remove(sys.shadowPlane);
  sys.shadowPlane.geometry.dispose();
  (sys.shadowPlane.material as THREE.Material).dispose();
  sys.coastal.foamMeshes.forEach(m => { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
  scene.remove(sys.coastal.mistPoints);
  sys.coastal.mistPoints.geometry.dispose();
  (sys.coastal.mistPoints.material as THREE.Material).dispose();
  scene.remove(sys.coastal.shallowPlane);
  sys.coastal.shallowPlane.geometry.dispose();
  (sys.coastal.shallowPlane.material as THREE.Material).dispose();
  sys.river.flowMeshes.forEach(m => { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
  scene.remove(sys.river.waterfallPoints);
  sys.river.waterfallPoints.geometry.dispose();
  (sys.river.waterfallPoints.material as THREE.Material).dispose();
}
