// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/nebula.ts — dua lapis atmosferik §2.2 (ATMOSPHERIC).
// Moved verbatim dari scene3d.ts. Texture disimpan di ctx (dipakai cosmic
// buat aurora) — satu-satunya export selain builder.

import * as THREE from "three";
import type { SceneContext } from "./bootstrap";
import { makeGlowTexture } from "./bootstrap";

/** Nebula sprites (default 9) — rebuildable via quality. */
export function buildNebula(ctx: SceneContext, count: number): void {
  const { scene, rand, nebulaSprites } = ctx;
  if (!ctx.nebulaTex) ctx.nebulaTex = makeGlowTexture();
  const nebulaTex = ctx.nebulaTex;
  for (const sp of nebulaSprites) { scene.remove(sp); (sp.material as THREE.SpriteMaterial).map?.dispose(); }
  nebulaSprites.length = 0;
  const palette = ["#1b2a5a", "#3a1b5a", "#0e3a2a", "#5a1b3a", "#1a3a5a"];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: nebulaTex,
      color: palette[i % palette.length],
      transparent: true,
      opacity: 0.04 + rand() * 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    const r = 20000 + rand() * 90000;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    spr.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.5 + 500, r * Math.sin(phi) * Math.sin(theta));
    const sc = 12000 + rand() * 26000;
    spr.scale.set(sc, sc * 0.8, 1);
    scene.add(spr);
    nebulaSprites.push(spr);
  }
}
