// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/oceanSystem.ts - 10.X.3 Ocean OceanState + vessel spray/wake/foam + sun reflection. Zoom dari blueprint "OceanState { wave direction/amplitude/frequency, wind relationship, roughness, depth, reflection, foam, disturbance } + SUN/OCEAN specular + VESSEL -> spray/wake/foam".

// WIRE NOTE for SESSION 2: import { deriveOceanState, createOceanWake, tickOcean } from "./planetary/oceanSystem" di scene3d/index.ts. Tick per frame dengan EnvironmentalContext.ocean + wind + sun + vessel velocity.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export interface OceanFrameState {
  waveAmplitude: number;
  waveFrequency: number;
  roughness: number;
  foam: number;
  reflection: number; // 0..1 sun specular
}

export function deriveOceanFrame(ctx: EnvironmentalContext, vesselSpeed: number): OceanFrameState {
  const ocean = ctx.ocean;
  const wind = ctx.wind;
  const sun = ctx.sun;
  // Wind relationship: wind 2..10 -> amplitude 1..3, roughness 0.4..0.75
  const windAmp = ocean.waveAmplitude * (0.7 + wind.speed * 0.06);
  const roughness = Math.min(0.85, ocean.roughness * (0.6 + wind.turbulence * 0.5) + vesselSpeed * 0.02);
  // Sun reflection: sunIntensity * (1 - roughness*0.5) * (1 - cloudCoverage*0.3)
  const reflection = sun.intensity * (1 - roughness * 0.4) * (1 - ctx.clouds.coverage * 0.25) * 0.9;
  // Foam: wind>6 + vesselSpeed>4
  const foam = Math.min(1, ocean.foam * 0.7 + (wind.speed > 6 ? 0.25 : 0) + (vesselSpeed > 4 ? 0.2 : 0));
  return { waveAmplitude: windAmp, waveFrequency: ocean.waveFrequency, roughness, foam, reflection };
}

export interface OceanWakeSystem {
  wakeMesh: THREE.Mesh;
  sprayPoints: THREE.Points;
}

export function createOceanWake(): OceanWakeSystem {
  // Wake: plane 40x120 trailing vessel
  const wakeGeo = new THREE.PlaneGeometry(12, 40);
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const wake = new THREE.Mesh(wakeGeo, wakeMat);
  wake.rotation.x = -Math.PI / 2;
  wake.position.y = 0.08;
  wake.name = "oceanWake";
  wake.visible = false;
  // Spray: 400 points
  const sprayGeo = new THREE.BufferGeometry();
  const cnt = 400;
  const pos = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) pos[i * 3 + 1] = Math.random() * 8;
  sprayGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const sprayMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, transparent: true, opacity: 0, depthWrite: false });
  const spray = new THREE.Points(sprayGeo, sprayMat);
  spray.name = "oceanSpray";
  return { wakeMesh: wake, sprayPoints: spray };
}

export function tickOcean(
  sys: OceanWakeSystem,
  state: OceanFrameState,
  vesselPos: { x: number; z: number; heading: number },
  vesselSpeed: number,
  dt: number,
): void {
  // Wake visible if vesselSpeed >2 and over ocean
  const moving = vesselSpeed > 2;
  sys.wakeMesh.visible = moving;
  sys.sprayPoints.visible = moving && state.foam > 0.25;
  if (moving) {
    sys.wakeMesh.position.x = vesselPos.x - Math.cos(vesselPos.heading) * 14;
    sys.wakeMesh.position.z = vesselPos.z - Math.sin(vesselPos.heading) * 14;
    sys.wakeMesh.rotation.z = vesselPos.heading;
    (sys.wakeMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.45, state.foam * 0.6 + vesselSpeed * 0.03);
    // Spray drift via wind
    const mat = sys.sprayPoints.material as THREE.PointsMaterial;
    mat.opacity = Math.min(0.55, state.foam * 0.5);
    const pos = sys.sprayPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - (4 + state.waveAmplitude * 2) * dt;
      if (y < 0) y = 6 + Math.random() * 4;
      pos.setY(i, y);
      pos.setX(i, (Math.random() - 0.5) * 8);
      pos.setZ(i, (Math.random() - 0.5) * 8);
    }
    pos.needsUpdate = true;
    sys.sprayPoints.position.set(vesselPos.x, 2, vesselPos.z);
  }
  // Micro-ripples hint: state.waveFrequency -> ocean material would update uTime, SESSION 2 reads state
}

export function getOceanReflectionStrength(state: OceanFrameState, sunIntensity: number): number {
  return state.reflection * (0.8 + sunIntensity * 0.2);
}

export function shouldShowWake(state: OceanFrameState, speed: number): boolean {
  return speed > 2.5 && state.roughness < 0.85;
}

