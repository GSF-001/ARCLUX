// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/lighting.ts — L1 Lighting: Key + Fill + Rim + Shadows + Light Probes.
// Lumen equivalent: indirect via light probes + SSGI approximation.
// VSM shadows for directional lights. Quality-tier gated.

import * as THREE from "three";
import type { SceneContext } from "./bootstrap";
import type { GameSettings } from "../settings";
import { threeColor } from "../../ui/tokens";

export interface LightRig {
  key: THREE.DirectionalLight;
  fill: THREE.HemisphereLight;
  rim: THREE.DirectionalLight;
  probe: THREE.LightProbe;
  shadowCamera: THREE.OrthographicCamera;
}

export interface LightingState {
  rig: LightRig | null;
  shadowMapEnabled: boolean;
  shadowResolution: number;
  sunShadowTarget: THREE.Vector3;
  lastSunPos: THREE.Vector3;
}

const SHADOW_BOUNDS = 8000; // world units covered by shadow camera
const SHADOW_NEAR = 100;
const SHADOW_FAR = 20000;

export function createLighting(ctx: SceneContext, settings: GameSettings): LightingState {
  const state: LightingState = {
    rig: null,
    shadowMapEnabled: settings.preset !== "LOW",
    shadowResolution: shadowResolutionForPreset(settings.preset),
    sunShadowTarget: new THREE.Vector3(),
    lastSunPos: new THREE.Vector3(),
  };

  // Enable shadows on renderer
  ctx.renderer.shadowMap.enabled = state.shadowMapEnabled;
  ctx.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // VSM-like quality
  ctx.renderer.shadowMap.autoUpdate = false; // manual control for perf

  // Create light rig
  state.rig = buildLightRig(ctx, state.shadowResolution);

  return state;
}

function shadowResolutionForPreset(preset: string): number {
  if (preset === "LOW") return 512;
  if (preset === "MEDIUM") return 1024;
  if (preset === "HIGH") return 2048;
  return 4096; // ULTRA / CINEMATIC
}

function buildLightRig(ctx: SceneContext, shadowRes: number): LightRig {
  const { scene } = ctx;

  // KEY LIGHT — Primary sun (directional, casts shadows)
  const key = new THREE.DirectionalLight(threeColor("#fff8f0"), 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowRes, shadowRes);
  key.shadow.camera.near = SHADOW_NEAR;
  key.shadow.camera.far = SHADOW_FAR;
  key.shadow.camera.left = -SHADOW_BOUNDS;
  key.shadow.camera.right = SHADOW_BOUNDS;
  key.shadow.camera.top = SHADOW_BOUNDS;
  key.shadow.camera.bottom = -SHADOW_BOUNDS;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4; // PCF softness
  scene.add(key);
  scene.add(key.target);

  // FILL LIGHT — Hemisphere for sky bounce (no shadows, cheap)
  const fill = new THREE.HemisphereLight(
    threeColor("#8aa8ff"), // sky color (cool)
    threeColor("#3a2a1a"), // ground color (warm)
    0.35
  );
  scene.add(fill);

  // RIM LIGHT — Backlight for vessels/stations (directional, no shadows)
  const rim = new THREE.DirectionalLight(threeColor("#fff0e0"), 0.6);
  rim.castShadow = false;
  scene.add(rim);
  scene.add(rim.target);

  // LIGHT PROBE — Indirect lighting approximation (Lumen equivalent)
  const probe = new THREE.LightProbe();
  probe.intensity = 0.8;
  scene.add(probe);

  // Shadow camera helper (for debug, not added to scene in production)
  const shadowCamera = key.shadow.camera;

  return { key, fill, rim, probe, shadowCamera };
}

export function updateLighting(
  ctx: SceneContext,
  state: LightingState,
  sunPos: THREE.Vector3,
  vesselPos: THREE.Vector3 | null,
  envContext: { sun: { intensity: number; elevation: number; color: string }; timeOfDay: string; atmosphere: { density: number } } | null,
  settings: GameSettings,
  dt: number
): void {
  if (!state.rig) return;

  const { key, fill, rim, probe, shadowCamera } = state.rig;

  // --- KEY LIGHT: track primary sun position ---
  const primarySun = ctx.suns[0];
  if (primarySun) {
    const sunWorldPos = primarySun.sun.position.clone();
    key.position.copy(sunWorldPos).normalize().multiplyScalar(5000); // directional from far away
    key.target.position.copy(vesselPos ?? new THREE.Vector3(0, 0, 0));
    key.target.updateMatrixWorld(true);

    // Update shadow camera to follow vessel (cascaded shadow equivalent)
    if (state.shadowMapEnabled && vesselPos) {
      state.sunShadowTarget.lerp(vesselPos, 0.1); // smooth follow
      shadowCamera.position.copy(state.sunShadowTarget).add(key.position.clone().normalize().multiplyScalar(SHADOW_BOUNDS));
      shadowCamera.lookAt(state.sunShadowTarget);
      shadowCamera.updateMatrixWorld(true);
      key.shadow.camera.updateMatrixWorld(true);
      key.shadow.needsUpdate = true;
    }

    // Intensity based on sun elevation + settings
    const baseIntensity = envContext ? envContext.sun.intensity * 2.5 : 2.5;
    key.intensity = THREE.MathUtils.lerp(key.intensity, baseIntensity, dt * 2);
    key.color.set(threeColor(envContext?.sun.color ?? "#fff8f0"));
  }

  // --- FILL LIGHT: sky/ground color based on time of day ---
  if (envContext) {
    const isNight = envContext.timeOfDay === "night";
    const elev = envContext.sun.elevation;
    
    // Sky color shifts: day=cool blue, dusk=warm orange, night=dark blue
    let skyColor, groundColor, fillIntensity;
    if (isNight) {
      skyColor = threeColor("#0a0a1a");
      groundColor = threeColor("#050508");
      fillIntensity = 0.15;
    } else if (elev < 0.2 && elev > -0.1) { // dawn/dusk
      skyColor = threeColor("#ff8844");
      groundColor = threeColor("#442211");
      fillIntensity = 0.45;
    } else { // day
      skyColor = threeColor("#8aa8ff");
      groundColor = threeColor("#3a2a1a");
      fillIntensity = 0.35;
    }
    
    fill.color.set(skyColor);
    fill.groundColor.set(groundColor);
    fill.intensity = THREE.MathUtils.lerp(fill.intensity, fillIntensity * envContext.atmosphere.density, dt * 1.5);
  }

  // --- RIM LIGHT: opposite to key for edge definition ---
  if (primarySun && vesselPos) {
    const sunDir = primarySun.sun.position.clone().normalize();
    rim.position.copy(sunDir.clone().multiplyScalar(-3000).add(vesselPos));
    rim.target.position.copy(vesselPos);
    rim.target.updateMatrixWorld(true);
    rim.intensity = THREE.MathUtils.lerp(rim.intensity, envContext ? 0.6 * envContext.sun.intensity : 0.6, dt * 2);
  }

  // --- LIGHT PROBE: update SH coefficients from environment (cheap indirect) ---
  if (probe && envContext) {
    // Simplified: probe color follows sky, intensity follows ambient
    const probeColor = isNight(envContext) ? threeColor("#1a1a2e") : threeColor("#4a6aa8");
    probe.color.set(probeColor);
    probe.intensity = isNight(envContext) ? 0.3 : 0.8 * envContext.atmosphere.density;
  }

  // Update shadow map resolution if quality changed
  const targetRes = shadowResolutionForPreset(settings.preset);
  if (state.shadowResolution !== targetRes && state.shadowMapEnabled) {
    state.shadowResolution = targetRes;
    key.shadow.mapSize.set(targetRes, targetRes);
    key.shadow.map?.dispose();
    key.shadow.map = null; // will be recreated on next render
  }
}

function isNight(env: { timeOfDay: string }): boolean {
  return env.timeOfDay === "night";
}

export function setEntityShadows(entity: THREE.Object3D, enabled: boolean): void {
  entity.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = enabled;
      obj.receiveShadow = enabled;
    }
  });
}

export function updateQualityLighting(state: LightingState, settings: GameSettings, renderer: THREE.WebGLRenderer): void {
  const enabled = settings.preset !== "LOW";
  if (state.shadowMapEnabled !== enabled) {
    state.shadowMapEnabled = enabled;
    renderer.shadowMap.enabled = enabled;
    if (state.rig) state.rig.key.castShadow = enabled;
  }

  const targetRes = shadowResolutionForPreset(settings.preset);
  if (state.shadowResolution !== targetRes && state.rig) {
    state.shadowResolution = targetRes;
    state.rig.key.shadow.mapSize.set(targetRes, targetRes);
    state.rig.key.shadow.map?.dispose();
    state.rig.key.shadow.map = null;
  }

  // Bloom strength gating (handled in quality.ts but shadow-related)
  if (state.rig) {
    state.rig.key.intensity = settings.preset === "LOW" ? 1.8 : 
                              settings.preset === "MEDIUM" ? 2.2 : 
                              settings.preset === "HIGH" ? 2.5 : 3.0;
  }
}

export function disposeLighting(ctx: SceneContext, state: LightingState): void {
  if (!state.rig) return;
  const { key, fill, rim, probe } = state.rig;
  ctx.scene.remove(key); ctx.scene.remove(key.target);
  ctx.scene.remove(fill);
  ctx.scene.remove(rim); ctx.scene.remove(rim.target);
  ctx.scene.remove(probe);
  key.shadow.map?.dispose();
  state.rig = null;
}