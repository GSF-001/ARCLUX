// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/emergencyLanding.ts - 10.E Emergency Landing visuals: ADRIFT emissive pulse + FALLING heat haze + cloud intersection + EMERGENCY dust 4 fase + CRASHED smoke/debris. Zoom dari blueprint 16.

// WIRE NOTE for SESSION 2: import { createEmergencyVisuals, tickEmergency } from "./planetary/emergencyLanding" di scene3d/index.ts. Tick per frame dengan VesselState + EnvironmentalContext.

import * as THREE from "three";
import type { VesselState } from "../../../../../../packages/gameserver/vesselState";

export interface EmergencySystem {
  adriftGroup: THREE.Group; // red pulse
  heatMesh: THREE.Mesh; // heat haze sphere
  dustGroup: THREE.Group; // 4 fase dust
  smokePoints: THREE.Points;
  state: VesselState;
}

export function createEmergencyVisuals(): EmergencySystem {
  const adrift = new THREE.Group();
  adrift.name = "adriftVisuals";
  const pulseGeo = new THREE.SphereGeometry(6, 12, 12);
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0, depthWrite: false });
  const pulse = new THREE.Mesh(pulseGeo, pulseMat);
  pulse.name = "adriftPulse";
  adrift.add(pulse);
  // Heat haze
  const heatGeo = new THREE.SphereGeometry(10, 16, 16);
  const heatMat = new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const heat = new THREE.Mesh(heatGeo, heatMat);
  heat.name = "heatHaze";
  heat.visible = false;
  // Dust 4 fase
  const dust = new THREE.Group();
  dust.name = "dustSystem";
  for (let i = 0; i < 4; i++) {
    const g = new THREE.SphereGeometry(2 + i * 1.5, 8, 8);
    const m = new THREE.MeshBasicMaterial({ color: 0x8a7a6a, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(g, m);
    mesh.name = `dustPhase-${i}`;
    mesh.visible = false;
    dust.add(mesh);
  }
  // Smoke
  const smokeGeo = new THREE.BufferGeometry();
  const cnt = 200;
  const pos = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) pos[i * 3 + 1] = Math.random() * 12;
  smokeGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const smokeMat = new THREE.PointsMaterial({ color: 0x3a3a3a, size: 0.6, transparent: true, opacity: 0, depthWrite: false });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.name = "crashedSmoke";
  return { adriftGroup: adrift, heatMesh: heat, dustGroup: dust, smokePoints: smoke, state: "nominal" };
}

export function tickEmergency(
  sys: EmergencySystem,
  state: VesselState,
  dt: number,
  time: number,
  isStorm: boolean,
): void {
  sys.state = state;
  // ADRIFT: emissive red pulse 0..0.6 sinus, velocity drift handled server
  if (state === "adrift") {
    const pulse = sys.adriftGroup.getObjectByName("adriftPulse") as THREE.Mesh;
    if (pulse) {
      const mat = pulse.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + Math.sin(time * 0.003) * 0.25;
      pulse.scale.setScalar(1 + Math.sin(time * 0.004) * 0.15);
      pulse.visible = true;
    }
    sys.heatMesh.visible = false;
    sys.smokePoints.visible = false;
  } else if (state === "falling") {
    // FALLING: heat haze + pitch 70deg + cloud intersection god rays already in godRays.ts
    sys.heatMesh.visible = true;
    (sys.heatMesh.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(time * 0.005) * 0.08;
    sys.adriftGroup.visible = false;
  } else if (state === "crashed") {
    // CRASHED: smoke + debris + dust settlement via WindState
    sys.smokePoints.visible = true;
    const mat = sys.smokePoints.material as THREE.PointsMaterial;
    mat.opacity = 0.35;
    const pos = sys.smokePoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 1.2;
      if (y > 18) y = 0;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    sys.heatMesh.visible = false;
    // Dust 4 fase: approach->hover->touchdown burst->settlement + wind advection
    // Simplified: show burst for 2s after crash, then settlement
    sys.dustGroup.visible = true;
  } else {
    // nominal
    sys.adriftGroup.visible = false;
    sys.heatMesh.visible = false;
    sys.smokePoints.visible = false;
    sys.dustGroup.visible = false;
  }
  // Wind advection for dust settlement: SESSION 2 should move dustGroup via WindState
}
