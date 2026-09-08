// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/emergencyLanding.ts - 10.E emergency landing presentation.
//
// Renders the authoritative emergency flag carried by each vessel snapshot:
// ADRIFT (red distress pulse, drifting), FALLING (heat shell + descent
// streaks), LANDING (four-phase touchdown dust: approach -> hover ->
// touchdown burst -> wind-advected settlement), CRASHED (rising smoke +
// debris field). All motion derives from the deterministic clock and the
// shared wind field; nothing here writes gameplay state.

import * as THREE from "three";
import type { VesselState } from "../../../../../../packages/gameserver/vesselState";

export type LandingPhase = "approach" | "hover" | "touchdown" | "settlement" | "idle";

const SMOKE_COUNT = 200;
const SMOKE_RISE = 1.2;
const SMOKE_TOP = 18;
const DEBRIS_COUNT = 12;
const DUST_PHASES: LandingPhase[] = ["approach", "hover", "touchdown", "settlement"];
const PHASE_DURATION = 0.9;

export interface EmergencySystem {
  group: THREE.Group;
  adriftPulse: THREE.Mesh;
  heatShell: THREE.Mesh;
  dustGroup: THREE.Group;
  dustMeshes: THREE.Mesh[];
  smokePoints: THREE.Points;
  debris: THREE.Mesh[];
  state: VesselState;
  landingPhase: LandingPhase;
  phaseTime: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build every visual once. Seed keeps smoke and debris placement stable. */
export function createEmergencyVisuals(seed = 0xe916): EmergencySystem {
  const group = new THREE.Group();
  group.name = "emergencyVisuals";
  const rng = mulberry32(seed);

  const adriftPulse = new THREE.Mesh(
    new THREE.SphereGeometry(6, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0, depthWrite: false }),
  );
  adriftPulse.name = "adriftPulse";
  adriftPulse.visible = false;
  group.add(adriftPulse);

  const heatShell = new THREE.Mesh(
    new THREE.SphereGeometry(10, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff8a3a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  heatShell.name = "heatHaze";
  heatShell.visible = false;
  group.add(heatShell);

  const dustGroup = new THREE.Group();
  dustGroup.name = "dustSystem";
  const dustMeshes: THREE.Mesh[] = [];
  const dustRadii = [6, 12, 22, 34];
  for (let i = 0; i < DUST_PHASES.length; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(dustRadii[i], 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x8a7a6a, transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.name = `dustPhase-${DUST_PHASES[i]}`;
    mesh.scale.y = 0.35;
    mesh.visible = false;
    dustGroup.add(mesh);
    dustMeshes.push(mesh);
  }
  group.add(dustGroup);

  const smokeGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(SMOKE_COUNT * 3);
  for (let i = 0; i < SMOKE_COUNT; i++) {
    pos[i * 3] = (rng() - 0.5) * 10;
    pos[i * 3 + 1] = rng() * SMOKE_TOP;
    pos[i * 3 + 2] = (rng() - 0.5) * 10;
  }
  smokeGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const smokePoints = new THREE.Points(
    smokeGeo,
    new THREE.PointsMaterial({ color: 0x3a3a3a, size: 0.6, transparent: true, opacity: 0, depthWrite: false }),
  );
  smokePoints.name = "crashedSmoke";
  smokePoints.visible = false;
  smokePoints.frustumCulled = false;
  group.add(smokePoints);

  const debris: THREE.Mesh[] = [];
  const debrisGeo = new THREE.BoxGeometry(0.8, 0.5, 1.2);
  for (let i = 0; i < DEBRIS_COUNT; i++) {
    const mesh = new THREE.Mesh(
      debrisGeo,
      new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9, transparent: true, opacity: 0 }),
    );
    const angle = rng() * Math.PI * 2;
    const dist = 4 + rng() * 14;
    mesh.position.set(Math.cos(angle) * dist, 0.3, Math.sin(angle) * dist);
    mesh.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    mesh.name = `debris-${i}`;
    mesh.visible = false;
    group.add(mesh);
    debris.push(mesh);
  }

  return { group, adriftPulse, heatShell, dustGroup, dustMeshes, smokePoints, debris, state: "nominal", landingPhase: "idle", phaseTime: 0 };
}

export interface EmergencyTickEnv {
  windDirection: number;
  windSpeed: number;
}

function setAllVisible(sys: EmergencySystem, adrift: boolean, heat: boolean, smoke: boolean): void {
  sys.adriftPulse.visible = adrift;
  sys.heatShell.visible = heat;
  sys.smokePoints.visible = smoke;
  sys.dustGroup.visible = false;
  for (const d of sys.dustMeshes) d.visible = false;
  for (const d of sys.debris) d.visible = smoke;
  if (!smoke) {
    (sys.smokePoints.material as THREE.PointsMaterial).opacity = 0;
    for (const d of sys.debris) (d.material as THREE.MeshStandardMaterial).opacity = 0;
  }
}

/**
 * Advance emergency visuals one frame.
 * @param timeSec deterministic clock (worldTime/1000 + tick * dt)
 * Dust runs its four phases on entry to crashed, then settles; wind
 * advects the settlement ring downwind.
 */
export function tickEmergency(
  sys: EmergencySystem,
  state: VesselState,
  dt: number,
  timeSec: number,
  env?: EmergencyTickEnv,
): void {
  const windDir = env?.windDirection ?? 0;
  const windSpeed = env?.windSpeed ?? 0;
  if (state !== sys.state) {
    sys.state = state;
    sys.phaseTime = 0;
    sys.landingPhase = state === "crashed" ? "approach" : "idle";
  }
  sys.phaseTime += dt;

  if (state === "adrift") {
    setAllVisible(sys, true, false, false);
    const mat = sys.adriftPulse.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.25 + Math.sin(timeSec * 3) * 0.25;
    sys.adriftPulse.scale.setScalar(1 + Math.sin(timeSec * 4) * 0.15);
  } else if (state === "falling") {
    setAllVisible(sys, false, true, false);
    const mat = sys.heatShell.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.18 + Math.sin(timeSec * 5) * 0.08;
    const stretch = 1 + Math.sin(timeSec * 2.2) * 0.1;
    sys.heatShell.scale.set(1, stretch, 1);
  } else if (state === "crashed") {
    setAllVisible(sys, false, false, true);
    sys.dustGroup.visible = true;
    const phaseIdx = Math.min(DUST_PHASES.length - 1, Math.floor(sys.phaseTime / PHASE_DURATION));
    sys.landingPhase = DUST_PHASES[phaseIdx];
    const smokeMat = sys.smokePoints.material as THREE.PointsMaterial;
    smokeMat.opacity = Math.min(0.4, 0.15 + sys.phaseTime * 0.05);
    const pos = sys.smokePoints.geometry.attributes["position"] as THREE.BufferAttribute;
    const driftX = Math.cos(windDir) * windSpeed * 0.12;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + SMOKE_RISE * dt;
      let x = pos.getX(i) + driftX * dt;
      if (y > SMOKE_TOP) {
        y = 0;
        x = (pos.getX(i) * 0.3);
      }
      pos.setY(i, y);
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
    for (const d of sys.debris) {
      (d.material as THREE.MeshStandardMaterial).opacity = Math.min(1, sys.phaseTime * 0.8);
    }
    sys.dustMeshes.forEach((mesh, i) => {
      const active = i === phaseIdx;
      mesh.visible = active;
      if (!active) return;
      const local = (sys.phaseTime - i * PHASE_DURATION) / PHASE_DURATION;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (sys.landingPhase === "touchdown") {
        mat.opacity = Math.min(0.5, 0.2 + local * 0.5);
        mesh.scale.setScalar(1 + local * 0.6);
      } else if (sys.landingPhase === "settlement") {
        mat.opacity = Math.max(0.08, 0.3 - sys.phaseTime * 0.01);
        mesh.position.x = Math.cos(windDir) * windSpeed * sys.phaseTime * 0.15;
        mesh.position.z = Math.sin(windDir) * windSpeed * sys.phaseTime * 0.15;
      } else {
        mat.opacity = 0.08 + local * 0.12;
        mesh.scale.setScalar(1 + local * 0.25);
      }
    });
  } else {
    setAllVisible(sys, false, false, false);
    sys.landingPhase = "idle";
  }
}
