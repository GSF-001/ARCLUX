// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import * as THREE from "three";

export type ImpactPhase = "IMPACT" | "DISPLACEMENT" | "DEBRIS" | "SMOKE" | "SETTLING" | "WRECK";

export interface ImpactState {
  eventId: string;
  phase: ImpactPhase;
  startedAt: number;
  position: { x: number; y: number; z: number };
  intensity: number;
  debrisCount: number;
  smokeOpacity: number;
  dustOpacity: number;
  wreckVisible: boolean;
  cameraKick: number;
}

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

export function createImpact(eventId: string, pos: { x: number; y: number; z: number }, intensity: number, now: number): ImpactState {
  return {
    eventId,
    phase: "IMPACT",
    startedAt: now,
    position: pos,
    intensity: clamp01(intensity),
    debrisCount: Math.floor(6 + intensity * 18),
    smokeOpacity: 0,
    dustOpacity: 0,
    wreckVisible: false,
    cameraKick: intensity,
  };
}

export function tickImpact(state: ImpactState, now: number, dt: number): ImpactState {
  const elapsed = now - state.startedAt;
  let phase: ImpactPhase = state.phase;
  if (elapsed < 120) phase = "IMPACT";
  else if (elapsed < 420) phase = "DISPLACEMENT";
  else if (elapsed < 1100) phase = "DEBRIS";
  else if (elapsed < 2600) phase = "SMOKE";
  else if (elapsed < 4200) phase = "SETTLING";
  else phase = "WRECK";
  const t = clamp01(elapsed / 4200);
  const smokeTarget = phase === "SMOKE" || phase === "SETTLING" ? 0.52 + state.intensity * 0.32 : phase === "WRECK" ? 0.18 : 0;
  const dustTarget = phase === "DEBRIS" || phase === "SMOKE" ? 0.42 + state.intensity * 0.28 : phase === "SETTLING" ? 0.18 : 0;
  const wreckVisible = phase === "WRECK" || phase === "SETTLING";
  const kick = phase === "IMPACT" ? state.intensity : phase === "DISPLACEMENT" ? state.intensity * 0.42 : 0;
  void dt;
  return {
    ...state,
    phase,
    smokeOpacity: smokeTarget * (0.7 + t * 0.3),
    dustOpacity: dustTarget,
    wreckVisible,
    cameraKick: kick,
  };
}

export interface ImpactSystem {
  debris: THREE.Group;
  smoke: THREE.Points;
  wreck: THREE.Group;
  flash: THREE.PointLight;
}

export function createImpactSystem(pos: { x: number; y: number; z: number }): ImpactSystem {
  const debris = new THREE.Group();
  debris.name = "impactDebris";
  debris.position.set(pos.x, pos.y, pos.z);
  for (let i = 0; i < 10; i++) {
    const g = new THREE.BoxGeometry(0.6 + Math.random() * 0.8, 0.4, 0.6);
    const m = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.82 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set((Math.random() - 0.5) * 8, Math.random() * 1.2, (Math.random() - 0.5) * 8);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    debris.add(mesh);
  }
  const sGeo = new THREE.BufferGeometry();
  const cnt = 240;
  const sPos = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    sPos[i * 3] = (Math.random() - 0.5) * 12;
    sPos[i * 3 + 1] = Math.random() * 9;
    sPos[i * 3 + 2] = (Math.random() - 0.5) * 12;
  }
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  const sMat = new THREE.PointsMaterial({ color: 0x8a8a8a, size: 0.9, transparent: true, opacity: 0, depthWrite: false });
  const smoke = new THREE.Points(sGeo, sMat);
  smoke.name = "impactSmoke";
  smoke.position.set(pos.x, pos.y + 1.2, pos.z);
  const wreck = new THREE.Group();
  wreck.name = "impactWreck";
  wreck.position.set(pos.x, pos.y, pos.z);
  wreck.visible = false;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.92 }));
  wreck.add(hull);
  const flash = new THREE.PointLight(0xff8a3a, 0, 48);
  flash.position.set(pos.x, pos.y + 3, pos.z);
  flash.name = "impactFlash";
  return { debris, smoke, wreck, flash };
}

export function updateImpactSystem(sys: ImpactSystem, state: ImpactState, dt: number): void {
  sys.debris.visible = state.phase === "DEBRIS" || state.phase === "SMOKE" || state.phase === "IMPACT";
  sys.debris.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.position.y -= dt * 0.6;
      o.rotation.x += dt * 0.8;
    }
  });
  const mat = sys.smoke.material as THREE.PointsMaterial;
  mat.opacity = state.smokeOpacity;
  sys.smoke.visible = mat.opacity > 0.04;
  if (sys.smoke.visible) {
    const pos = sys.smoke.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + dt * 0.9);
    pos.needsUpdate = true;
  }
  sys.wreck.visible = state.wreckVisible;
  sys.flash.intensity = state.phase === "IMPACT" ? state.intensity * 18 : state.phase === "DISPLACEMENT" ? state.intensity * 6 : 0;
  sys.flash.visible = sys.flash.intensity > 0.5;
}

export function disposeImpactSystem(sys: ImpactSystem): void {
  sys.debris.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | undefined;
    if (mat) mat.dispose();
  });
  sys.smoke.geometry.dispose();
  (sys.smoke.material as THREE.Material).dispose();
  sys.wreck.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | undefined;
    if (mat) mat.dispose();
  });
}
