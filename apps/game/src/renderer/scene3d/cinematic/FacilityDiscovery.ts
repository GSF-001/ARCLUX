// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type DiscoveryPhase = "DISTANT" | "FOG" | "SILHOUETTE" | "LIGHT" | "DETAIL" | "HANGAR";

export interface DiscoveryState {
  facilityId: string;
  phase: DiscoveryPhase;
  distance: number;
  progress: number;
  emissive: number;
  beaconVisible: boolean;
  runwayVisible: boolean;
}

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

export function deriveDiscoveryState(
  facilityId: string,
  facilityPos: { x: number; z: number },
  cameraPos: { x: number; z: number },
  env: EnvironmentalContext,
  prev: DiscoveryState | null,
): DiscoveryState {
  const dx = facilityPos.x - cameraPos.x;
  const dz = facilityPos.z - cameraPos.z;
  const dist = Math.hypot(dx, dz);
  const fogFactor = 1 - clamp01(env.atmosphere.visibility / 9000);
  const isNight = env.timeOfDay === "night";
  let phase: DiscoveryPhase = "DISTANT";
  if (dist > 4200) phase = "DISTANT";
  else if (dist > 1800) phase = fogFactor > 0.42 ? "FOG" : "SILHOUETTE";
  else if (dist > 700) phase = isNight ? "LIGHT" : "SILHOUETTE";
  else if (dist > 160) phase = "DETAIL";
  else phase = "HANGAR";
  const progress = clamp01(1 - dist / 5200);
  const emissive = isNight ? clamp01(0.42 + (1 - dist / 2400) * 0.58) : clamp01((1 - dist / 3200) * 0.22);
  const beaconVisible = dist < 2400 && isNight;
  const runwayVisible = dist < 1100;
  void prev;
  return { facilityId, phase, distance: dist, progress, emissive, beaconVisible, runwayVisible };
}

export interface DiscoverySystem {
  beacon: THREE.PointLight;
  runway: THREE.Group;
  silhouette: THREE.Mesh;
}

export function createDiscoverySystem(pos: { x: number; y: number; z: number }): DiscoverySystem {
  const beacon = new THREE.PointLight(0xffd9a0, 0, 900);
  beacon.position.set(pos.x, pos.y + 22, pos.z);
  beacon.name = "discoveryBeacon";
  const runway = new THREE.Group();
  runway.name = "discoveryRunway";
  runway.position.set(pos.x, pos.y + 0.08, pos.z);
  for (let i = 0; i < 8; i++) {
    const g = new THREE.PlaneGeometry(2.2, 2.2);
    const m = new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((i - 3.5) * 14, 0.02, 0);
    runway.add(mesh);
  }
  const sg = new THREE.PlaneGeometry(80, 80);
  const sm = new THREE.MeshBasicMaterial({ color: 0x2a3a4a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const silhouette = new THREE.Mesh(sg, sm);
  silhouette.rotation.x = -Math.PI / 2;
  silhouette.position.set(pos.x, pos.y + 8, pos.z);
  silhouette.name = "discoverySilhouette";
  return { beacon, runway, silhouette };
}

export function tickDiscovery(sys: DiscoverySystem, state: DiscoveryState, dt: number): void {
  const a = 1 - Math.exp(-dt * 2.8);
  const targetBeacon = state.beaconVisible ? 1.8 + state.emissive * 1.2 : 0;
  sys.beacon.intensity += (targetBeacon - sys.beacon.intensity) * a;
  sys.beacon.visible = sys.beacon.intensity > 0.08;
  sys.runway.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (!m) return;
    const target = state.runwayVisible ? 0.72 + state.emissive * 0.28 : 0;
    m.opacity += (target - m.opacity) * a;
  });
  sys.runway.visible = state.phase !== "DISTANT";
  const silMat = sys.silhouette.material as THREE.MeshBasicMaterial;
  const silTarget = state.phase === "SILHOUETTE" || state.phase === "FOG" ? 0.32 + state.progress * 0.22 : state.phase === "LIGHT" ? 0.18 : 0;
  silMat.opacity += (silTarget - silMat.opacity) * a;
  sys.silhouette.visible = silMat.opacity > 0.04;
}

export function disposeDiscoverySystem(sys: DiscoverySystem): void {
  sys.beacon.dispose();
  sys.runway.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | undefined;
    if (mat) mat.dispose();
  });
  sys.silhouette.geometry.dispose();
  (sys.silhouette.material as THREE.Material).dispose();
}
