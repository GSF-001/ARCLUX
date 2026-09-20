// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/interiorAnim.ts — H1.1 (animated lights) + H1.3 (mesin bergerak).
// Semua f(timeSec), 0 authority. Budget: ≤0.2ms.

import * as THREE from "three";
import type { InteriorBuildResult } from "../interior";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface InteriorAnimState {
  corridorStrip: THREE.Mesh | null;
  advertBoards: THREE.Mesh[];
  stallGlows: THREE.Sprite[];
  hangarDoors: [THREE.Mesh, THREE.Mesh];
  hangarLight: THREE.PointLight;
  fans: THREE.Mesh[];
  crane: THREE.Mesh;
  conveyorMat: THREE.MeshStandardMaterial | null;
}

// ---------------------------------------------------------------------------
// Build animation state from InteriorBuildResult
// ---------------------------------------------------------------------------

export function createInteriorAnimState(result: InteriorBuildResult): InteriorAnimState {
  let corridorStrip: THREE.Mesh | null = null;
  const advertBoards: THREE.Mesh[] = [];
  const stallGlows: THREE.Sprite[] = [];
  const fans: THREE.Mesh[] = [];

  // H1.1 — Find corridor amber strip (BoxGeometry width >300, height <2)
  result.corridor.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.geometry || m.geometry.type !== "BoxGeometry") return;
    const p = (m.geometry as THREE.BoxGeometry).parameters;
    if (p.width > 300 && p.height < 2 && p.depth < 3 && !corridorStrip) {
      corridorStrip = m;
    }
    // Advert boards: 12 panel lines in corridor (width >100, height 1.1)
    if (p.width > 100 && p.width < 400 && Math.abs(p.height - 1.1) < 0.2 && p.depth < 5) {
      advertBoards.push(m);
    }
  });

  // H1.1 — Bazaar stall glow sprites (signage sprites at y=32)
  for (const stall of result.bazaarStalls) {
    stall.traverse((o) => {
      const s = o as THREE.Sprite;
      if (s.isSprite && s.position.y > 28) {
        stallGlows.push(s);
      }
    });
  }

  // H1.3 — Hangar door L position.y determines open/close
  const [doorL, doorR] = result.hangarDoors;

  // H1.3 — Create 2 ventilation fans + 1 crane if not present
  const fanGeo = new THREE.CylinderGeometry(14, 14, 2, 12);
  const fanMat = new THREE.MeshStandardMaterial({ color: 0x5a6577, metalness: 0.55, roughness: 0.4 });
  for (let i = 0; i < 2; i++) {
    const fan = new THREE.Mesh(fanGeo, fanMat);
    fan.position.set(100 + i * 200, 88, -80 + i * 160);
    fan.name = "hangarFan";
    result.hangar.add(fan);
    fans.push(fan);
  }

  // Crane beam
  const craneGeo = new THREE.BoxGeometry(4, 4, 100);
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.5 });
  const crane = new THREE.Mesh(craneGeo, craneMat);
  crane.position.set(200, 70, 0);
  crane.name = "hangarCrane";
  result.hangar.add(crane);

  return {
    corridorStrip,
    advertBoards,
    stallGlows,
    hangarDoors: [doorL, doorR],
    hangarLight: result.hangarLight,
    fans,
    crane,
    conveyorMat: null,
  };
}

// ---------------------------------------------------------------------------
// Tick — per-frame, ≤0.2ms
// ---------------------------------------------------------------------------

export function tickInteriorAnim(state: InteriorAnimState, timeSec: number): void {
  // H1.1 — Corridor strip pulse 0.5Hz (emissiveIntensity sine)
  if (state.corridorStrip) {
    const mat = state.corridorStrip.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.8 + 0.5 * Math.sin(timeSec * Math.PI); // 0.5Hz
  }

  // H1.1 — Advert board scan: emissive rotates through boards (≤8 mat/frame cap)
  const boardCount = Math.min(state.advertBoards.length, 8);
  for (let i = 0; i < boardCount; i++) {
    const mat = state.advertBoards[i].material as THREE.MeshStandardMaterial;
    const phase = (timeSec * 1.2 + i * 0.4) % (Math.PI * 2);
    mat.emissiveIntensity = 0.3 + 0.7 * Math.max(0, Math.sin(phase));
  }

  // H1.1 — Bazaar stall glow gantian (alternating pairs)
  for (let i = 0; i < state.stallGlows.length; i++) {
    const spr = state.stallGlows[i];
    const phase = (timeSec * 0.8 + i * 0.6) % (Math.PI * 2);
    (spr.material as THREE.SpriteMaterial).opacity = 0.3 + 0.5 * Math.max(0, Math.sin(phase));
  }

  // H1.3 — Hangar door cycle: 8s total (4s open, 4s close)
  const doorCycle = (timeSec % 8) / 8; // 0..1
  const doorOpen = doorCycle < 0.5 ? doorCycle * 2 : 2 - doorCycle * 2; // 0→1→0
  const doorOffset = doorOpen * 90; // max 90 units open
  state.hangarDoors[0].position.z = -306 + doorOffset;
  state.hangarDoors[1].position.z = -306 - doorOffset;
  // Bay light follows door
  state.hangarLight.intensity = 0.2 + doorOpen * 1.3;

  // H1.3 — Fan rotation (spin Y axis)
  for (const fan of state.fans) {
    fan.rotation.y += 0.12; // steady rotation
  }

  // H1.3 — Crane lateral loop ±2m (sinusoidal)
  state.crane.position.x = 200 + Math.sin(timeSec * 0.3) * 200; // ±200 units = ±2m at scale
}
