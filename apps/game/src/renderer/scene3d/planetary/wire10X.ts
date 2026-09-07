// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/wire10X.ts - 10.X.1-X.4 single wiring point.
// Owns every cinematic atmosphere system (sun, cloud shadows, god rays,
// weather stack, rain, lightning, fog, vegetation, ocean wake, volumes,
// budget) and advances them from the one EnvironmentalContext the scene
// already maintains. Visual-only: reads authority state, never writes it.
//
// The orbital key light stays owned by the Kepler sun system; the planetary
// sun only drives ambient and material tint through applySunToAmbientFog.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";
import type { VesselEntity } from "../../../../../../packages/gameserver/types";
import {
  sunUniformsFromContext,
  applySunToAmbientFog,
  type SunUniforms,
} from "./sun";
import {
  createCloudShadowSystem,
  tickCloudShadows,
  type CloudShadowSystem,
} from "./cloudShadows";
import {
  deriveGodRayContext,
  createGodRaySystem,
  updateGodRays,
  type GodRaySystem,
} from "./godRays";
import {
  deriveWeatherStack,
  getWeatherExposure,
  type WeatherStack,
  type WeatherStackPhase,
} from "./weatherStack";
import {
  deriveRainState,
  createRainSystem,
  tickRain,
  type RainSystem,
} from "./rain";
import {
  createLightningSystem,
  shouldTriggerLightning,
  triggerLightning,
  tickLightning,
  type LightningSystem,
} from "./lightning";
import {
  deriveFogState,
  createFogSystem,
  tickFog,
  type FogSystem,
} from "./fog";
import {
  createVegetationSystem,
  tickVegetation,
  cullVegetationByDistance,
  type VegetationSystem,
} from "./vegetation";
import {
  deriveOceanFrame,
  createOceanWake,
  tickOcean,
  type OceanWakeSystem,
} from "./oceanSystem";
import {
  createLocalVolumeManager,
  ensureVolume,
  updateLocalVolumes,
  getVolumeCost,
  type LocalVolumeManager,
} from "./localVolumes";
import {
  deriveQualityLevelStable,
  getBudget,
  shouldAllowEffect,
  type QualityLevel,
} from "./qualityBudget";

export interface Planetary10XTickOpts {
  timeSec: number; // deterministic clock: worldTime/1000 + tick * dt
  anchor: { x: number; z: number }; // player ground position
  cameraPos: { x: number; y: number; z: number };
  altitude: number; // meters above surface
  vessel?: VesselEntity;
  ambient?: THREE.AmbientLight | null;
  renderer?: THREE.WebGLRenderer;
}

export interface Planetary10X {
  sun: SunUniforms | null;
  shadows: CloudShadowSystem;
  godRays: GodRaySystem;
  weather: WeatherStack | null;
  prevPhase: WeatherStackPhase | undefined;
  rain: RainSystem;
  puddle: number;
  lightning: LightningSystem;
  fog: FogSystem;
  vegetation: VegetationSystem;
  wake: OceanWakeSystem;
  volumes: LocalVolumeManager;
  quality: QualityLevel;
  exposure: number;
}

/** Build all systems once and attach their groups to the scene. */
export function createPlanetary10X(scene: THREE.Scene, seed = 0x1017): Planetary10X {
  void seed;
  const shadows = createCloudShadowSystem();
  const godRays = createGodRaySystem();
  const rain = createRainSystem();
  const lightning = createLightningSystem();
  const fog = createFogSystem(scene);
  const vegetation = createVegetationSystem();
  const wake = createOceanWake();
  scene.add(shadows.group);
  scene.add(godRays.group);
  scene.add(rain.group);
  scene.add(lightning.flashLight);
  scene.add(lightning.boltMesh);
  scene.add(vegetation.group);
  scene.add(wake.wakeMesh);
  scene.add(wake.sprayPoints);
  return {
    sun: null,
    shadows,
    godRays,
    weather: null,
    prevPhase: undefined,
    rain,
    puddle: 0,
    lightning,
    fog,
    vegetation,
    wake,
    volumes: createLocalVolumeManager(),
    quality: "MEDIUM",
    exposure: 1,
  };
}

function vesselSpeed(v?: VesselEntity): number {
  if (!v) return 0;
  return Math.hypot(v.velocity.x, v.velocity.y, v.velocity.z);
}

/** Advance every system one frame from the shared authority context. */
export function tickPlanetary10X(
  sys: Planetary10X,
  scene: THREE.Scene,
  env: EnvironmentalContext,
  dt: number,
  opts: Planetary10XTickOpts,
): void {
  void scene;
  const nowMs = opts.timeSec * 1000;

  const sun = sunUniformsFromContext(env);
  sys.sun = sun;
  applySunToAmbientFog(opts.ambient ?? null, sun);

  tickCloudShadows(sys.shadows, env, dt, opts.timeSec, opts.anchor);

  const occlusion = Math.min(0.8, 0.3 + env.terrain.slope * 0.5);
  const gctx = deriveGodRayContext(env, opts.cameraPos, occlusion);
  updateGodRays(sys.godRays, gctx, dt, opts.timeSec);

  const stack = deriveWeatherStack(env, sys.prevPhase);
  sys.prevPhase = stack.phase;
  sys.weather = stack;
  sys.exposure = getWeatherExposure(stack);
  if (opts.renderer) opts.renderer.toneMappingExposure = sys.exposure;

  const rainState = deriveRainState(env, dt, sys.puddle);
  sys.puddle = rainState.puddleLevel;
  tickRain(sys.rain, rainState, dt);

  if (shouldTriggerLightning(env.simulationTick, env.planetSeed, stack.phase === "storm")) {
    triggerLightning(sys.lightning, { x: opts.anchor.x, y: 300, z: opts.anchor.z }, nowMs);
  }
  tickLightning(sys.lightning, nowMs);

  const fogState = deriveFogState(env, opts.altitude);
  tickFog(sys.fog, fogState, sun.color);

  tickVegetation(sys.vegetation, env, dt, opts.timeSec);

  const speed = vesselSpeed(opts.vessel);
  const frame = deriveOceanFrame(env, speed);
  if (opts.vessel) {
    const heading = Math.atan2(opts.vessel.velocity.z, opts.vessel.velocity.x);
    tickOcean(
      sys.wake,
      frame,
      { x: opts.vessel.position.x, z: opts.vessel.position.z, heading },
      speed,
      dt,
      env.wind,
    );
  } else {
    sys.wake.wakeMesh.visible = false;
    sys.wake.sprayPoints.visible = false;
  }

  ensureVolume(sys.volumes, "player", "player", { x: opts.anchor.x, y: 0, z: opts.anchor.z }, 200);
  updateLocalVolumes(sys.volumes, { x: opts.anchor.x, y: 0, z: opts.anchor.z }, dt);
  const playerCost = getVolumeCost(sys.volumes, "player");
  const camDist = Math.hypot(opts.cameraPos.x - opts.anchor.x, opts.cameraPos.z - opts.anchor.z);
  sys.quality = deriveQualityLevelStable(camDist, playerCost, sys.quality);
  const budget = getBudget(camDist, playerCost, 1);
  sys.godRays.group.visible = shouldAllowEffect(budget, "godRays");
  sys.shadows.group.visible = shouldAllowEffect(budget, "shadows");
  sys.rain.particles.visible =
    shouldAllowEffect(budget, "particles") && (rainState.intensity > 0.08 || sys.puddle > 0.05);
  cullVegetationByDistance(sys.vegetation, 40 + playerCost * 160, opts.anchor);
}

/** Detach groups from the scene and free GPU resources. */
export function disposePlanetary10X(scene: THREE.Scene, sys: Planetary10X): void {
  scene.remove(sys.shadows.group);
  scene.remove(sys.godRays.group);
  scene.remove(sys.rain.group);
  scene.remove(sys.lightning.flashLight);
  scene.remove(sys.lightning.boltMesh);
  scene.remove(sys.vegetation.group);
  scene.remove(sys.wake.wakeMesh);
  scene.remove(sys.wake.sprayPoints);
  const disposeGroup = (root: THREE.Object3D): void => {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else if (material) material.dispose();
    });
  };
  disposeGroup(sys.shadows.group);
  disposeGroup(sys.godRays.group);
  disposeGroup(sys.rain.group);
  disposeGroup(sys.vegetation.group);
  sys.lightning.boltMesh.geometry.dispose();
  (sys.lightning.boltMesh.material as THREE.Material).dispose();
}
