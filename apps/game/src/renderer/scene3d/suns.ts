// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/suns.ts — binary/trinary §2.1 + termal §2.6. Companion mengorbit
// barycenter dekat. Moved verbatim dari scene3d.ts. coronaTex disimpan di
// ctx (dipakai planets buat atmosfer) — dependency sebagai data, bukan
// import antar modul.

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import type { SceneContext, Sun3D } from "./bootstrap";
import { makeGlowTexture } from "./bootstrap";
import { keplerPosition } from "./orbital";
import type { OrbitSpec } from "./orbital";

/** (Re)build suns — companion di orbit, primary di barycenter. */
export function buildSuns(ctx: SceneContext, n: number): void {
  const { scene, suns } = ctx;
  for (const s of suns) {
    scene.remove(s.sun); scene.remove(s.glow); scene.remove(s.light);
    (s.sun.material as THREE.Material).dispose();
    (s.glow.material as THREE.SpriteMaterial).map?.dispose();
  }
  suns.length = 0;
  if (!ctx.coronaTex) ctx.coronaTex = makeGlowTexture();
  const coronaTex = ctx.coronaTex;
  const massRatio = n === 3 ? [0.9, 0.5, 0.7] : n === 2 ? [1.0, 0.55] : [1.0];
  for (let i = 0; i < n; i++) {
    const sunMat = new THREE.MeshStandardMaterial({
      color: threeColor(colors.sun),
      emissive: threeColor(colors.sunEmissive),
      emissiveIntensity: 2.4 * massRatio[i],
    });
    const sun = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 64), sunMat);
    scene.add(sun);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coronaTex, color: threeColor(colors.sunEmissive), transparent: true, opacity: 0.5 * massRatio[i],
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(16000 * massRatio[i], 16000 * massRatio[i], 1);
    scene.add(glow);
    const light = new THREE.DirectionalLight(threeColor(colors.sunCore), 2.2 * massRatio[i]);
    scene.add(light);
    // Companion mengorbit barycenter dekat (binary/trinary, §2.1).
    const orbit: OrbitSpec = i === 0
      ? { semimajor: 0, eccentricity: 0, omega: 0, phase: 0, inclination: 0 }
      : { semimajor: 2600 + i * 900, eccentricity: 0.12, omega: i === 1 ? 0.013 : 0.007, phase: i * 2.1, inclination: 0.3 };
    suns.push({ sun, glow, light, orbit });
  }
  // Ambient sekali — bukan per rebuild (guard biar quality re-call aman).
  if (!ctx.ambient) {
    ctx.ambient = new THREE.AmbientLight(threeColor(colors.struct), 0.5);
    scene.add(ctx.ambient);
  }
}

/** Companion mengorbit barycenter (primary diam) — dipanggil per frame. */
export function updateSuns(ctx: SceneContext, tick: number): void {
  const suns: Sun3D[] = ctx.suns;
  for (let i = 1; i < suns.length; i++) {
    const p = keplerPosition(suns[i].orbit, tick);
    suns[i].sun.position.copy(p);
    suns[i].glow.position.copy(p);
    suns[i].light.position.copy(p);
  }
}
