// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/vessels.ts — vessel AAA+ (LOCAL scale §2.5) + interpolasi snapshot
// (presentation only — otoritas tetap server D-008). Moved verbatim dari
// scene3d.ts. clampLocal dipakai camera.ts juga (shared math, bukan state).

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import type { VesselEntity } from "../../../../../packages/gameserver/types";
import type { SceneContext } from "./bootstrap";
import { makeGlowTexture } from "./bootstrap";

/** local meters → render units (§2.5). */
export const LOCAL_SCALE = 1 / 90000;

/** Posisikan relatif anchor + clamp 6000 (vessel jauh tidak "kabur"). */
export function clampLocal(v: THREE.Vector3, a: THREE.Vector3): THREE.Vector3 {
  return v.clone().sub(a).multiplyScalar(LOCAL_SCALE).clampLength(0, 6000);
}

export function ensureEntry(ctx: SceneContext, id: string, build: () => THREE.Group, map: Map<string, THREE.Group>): THREE.Group {
  let grp = map.get(id);
  if (grp) return grp;
  grp = build();
  grp.name = id;
  ctx.scene.add(grp);
  map.set(id, grp);
  return grp;
}

/** AAA+ vessel: fuselage + canopy + delta wings + nacelles + weapons + shield. */
export function buildVessel(): THREE.Group {
  const g = new THREE.Group();

  // --- AAA+ Studio materials (PBR, pantul env map Fase 1) ---
  const hullMat = new THREE.MeshStandardMaterial({
    color: threeColor(colors.hull), metalness: 0.78, roughness: 0.28,
    emissive: threeColor("#0a1424"), emissiveIntensity: 0.45,
  });
  const hullHighMat = new THREE.MeshStandardMaterial({
    color: threeColor(colors.hullHigh), metalness: 0.72, roughness: 0.32,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: threeColor(colors.structHigh), metalness: 0.75, roughness: 0.3,
  });
  const cockpitMat = new THREE.MeshPhysicalMaterial({
    color: threeColor("#a8d8ff"), metalness: 0.05, roughness: 0.08,
    transmission: 0.82, thickness: 1.2, ior: 1.45, transparent: true, opacity: 0.92,
    envMapIntensity: 1.4,
  });
  const engineMetalMat = new THREE.MeshStandardMaterial({
    color: threeColor("#1a2535"), metalness: 0.85, roughness: 0.35,
    emissive: threeColor(colors.glowEngine), emissiveIntensity: 0.55,
  });

  // Fuselage utama — tapered box (studio hard-surface)
  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 52), hullMat);
  fuselage.position.y = 1.5;
  g.add(fuselage);

  // Nose — cone runcing depan
  const nose = new THREE.Mesh(new THREE.ConeGeometry(9, 28, 12), hullHighMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.5, -40);
  g.add(nose);

  // Cockpit canopy — dome kaca di atas depan
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(7.5, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), cockpitMat);
  canopy.position.set(0, 8.2, -18);
  canopy.rotation.x = -0.18;
  canopy.scale.set(1, 0.72, 1.35);
  g.add(canopy);
  // Cockpit frame — rim tipis
  const frame = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.7, 8, 24, Math.PI), accentMat);
  frame.position.set(0, 5.8, -18);
  frame.rotation.x = Math.PI / 2;
  frame.scale.set(1, 1.35, 1);
  g.add(frame);

  // Delta wings — swept-back hard-surface (kiri/kanan)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(26, 0);
  wingShape.lineTo(8, 22);
  wingShape.lineTo(0, 22);
  wingShape.lineTo(0, 0);
  const wingExtrude = new THREE.ExtrudeGeometry(wingShape, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.3, bevelSegments: 2 });
  wingExtrude.translate(0, 0, -1.1);
  const wingL = new THREE.Mesh(wingExtrude, hullHighMat);
  wingL.position.set(9, 0.5, 6);
  const wingRExtrude = wingExtrude.clone();
  wingRExtrude.scale(-1, 1, 1);
  (wingRExtrude as THREE.BufferGeometry).computeVertexNormals();
  const wingR = new THREE.Mesh(wingRExtrude, hullHighMat);
  wingR.position.set(-9, 0.5, 6);
  g.add(wingL, wingR);

  // Canard depan kecil
  const canardL = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 7), accentMat);
  canardL.position.set(12, 1.2, -14);
  canardL.rotation.y = 0.55;
  const canardR = canardL.clone();
  canardR.position.set(-12, 1.2, -14);
  canardR.rotation.y = -0.55;
  g.add(canardL, canardR);

  // Engine nacelles — 2 cylinder di belakang
  const nacelleGeom = new THREE.CylinderGeometry(4.2, 4.6, 22, 16);
  const nacL = new THREE.Mesh(nacelleGeom, engineMetalMat);
  nacL.rotation.x = Math.PI / 2;
  nacL.position.set(10, 1.2, 28);
  const nacR = nacL.clone();
  nacR.position.set(-10, 1.2, 28);
  g.add(nacL, nacR);
  // Engine glow — sprite di exhaust
  const engGlowTex = makeGlowTexture();
  const glowMat = new THREE.SpriteMaterial({ map: engGlowTex, color: threeColor(colors.glowEngine), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const engL = new THREE.Sprite(glowMat);
  engL.position.set(10, 1.2, 39);
  engL.scale.set(14, 14, 1);
  const engR = new THREE.Sprite(glowMat.clone());
  (engR.material as THREE.SpriteMaterial).color = new THREE.Color(threeColor(colors.glowEngine));
  engR.position.set(-10, 1.2, 39);
  engR.scale.set(14, 14, 1);
  g.add(engL, engR);
  // Heat distortion ring — torus tipis di exhaust
  const afterburnerMat = new THREE.MeshBasicMaterial({ color: threeColor(colors.glowEngine), transparent: true, opacity: 0.35 });
  const ringL = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.9, 8, 24), afterburnerMat);
  ringL.position.set(10, 1.2, 39);
  ringL.rotation.x = Math.PI / 2;
  const ringR = ringL.clone();
  ringR.position.set(-10, 1.2, 39);
  g.add(ringL, ringR);

  // Weapon mounts — di wing tip
  const mountGeom = new THREE.BoxGeometry(5, 2.2, 8);
  const mountL = new THREE.Mesh(mountGeom, accentMat);
  mountL.position.set(34, 0.2, 12);
  const mountR = mountL.clone();
  mountR.position.set(-34, 0.2, 12);
  g.add(mountL, mountR);
  const barrelGeom = new THREE.CylinderGeometry(0.9, 1.1, 14, 8);
  const barrelMat = new THREE.MeshStandardMaterial({ color: threeColor("#2a3448"), metalness: 0.85, roughness: 0.2 });
  const barrelL = new THREE.Mesh(barrelGeom, barrelMat);
  barrelL.rotation.x = Math.PI / 2;
  barrelL.position.set(34, 0.2, 4);
  const barrelR = barrelL.clone();
  barrelR.position.set(-34, 0.2, 4);
  g.add(barrelL, barrelR);

  // Spine fin atas
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 16), accentMat);
  fin.position.set(0, 9.5, 10);
  fin.rotation.x = 0.22;
  g.add(fin);

  // Shield bubble — tetap, opacity ikut health (di-update luar jika perlu)
  const shield = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: threeColor(colors.glowShield), transparent: true, opacity: 0.32,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  shield.scale.set(52, 52, 1);
  g.add(shield);

  return g;
}

/** Catat posisi target render (dipanggil renderRegion per snapshot). */
export function updateVessel(ctx: SceneContext, v: VesselEntity): void {
  const grp = ensureEntry(ctx, v.id, () => buildVessel(), ctx.vessels);
  const p = clampLocal(new THREE.Vector3(v.position.x, v.position.y, v.position.z), ctx.anchor);
  ctx.cur.set(v.id, p);
  if (!ctx.prev.has(v.id)) ctx.prev.set(v.id, p.clone());
  grp.rotation.set(v.heading.pitch, v.heading.yaw, 0);
}

/** Interpolasi antar snapshot — dipanggil per frame (presentation only). */
export function updateVesselInterp(ctx: SceneContext, now: number): void {
  const alpha = Math.min(1, (now - ctx.lastSnapshotAt) / 100);
  for (const [id, grp] of ctx.vessels) {
    const a = ctx.prev.get(id); const b = ctx.cur.get(id);
    if (a && b) grp.position.lerpVectors(a, b, alpha);
  }
}
