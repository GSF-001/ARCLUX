// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/post.ts — post-processing (glow real, bukan sprite):
// EffectComposer + RenderPass + UnrealBloomPass + OutputPass (core THREE,
// no CDN — CSP default-src 'self'). Moved verbatim dari scene3d.ts.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { SceneContext } from "./bootstrap";
import { createCockpitGradePass } from "./cockpitGradePass";
import { createGradePass } from "./gradePass";
import { createFinalTouchPass } from "./finalTouchPass";

/**
 * 10.V P1.3 — urutan composer FINAL (jangan dibolak-balik):
 * Render -> Bloom -> Grade -> CockpitGrade (U4) -> FinalTouch -> Output.
 * Grade di linear HDR sebelum tone-map; kokpit di atas grade (kaca
 * mewarnai dunia jadi); touch paling akhir (cacat lensa + film).
 * Didefinisikan SEKALI di sini, di-assert smoke (P1.3).
 */
export const POST_PASS_ORDER = ["render", "bloom", "grade", "cockpit", "touch", "output"] as const;

/** Rakit composer di atas renderer+scene+camera ctx (bloom 1.15/0.45/0.65). */
export function createPost(ctx: SceneContext): void {
  if (!ctx.camera) return;
  const composer = new EffectComposer(ctx.renderer);
  const renderPass = new RenderPass(ctx.scene, ctx.camera);
  composer.addPass(renderPass);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(ctx.width, ctx.height), 1.15, 0.45, 0.65);
  composer.addPass(bloomPass);
  const gradePass = createGradePass();
  composer.addPass(gradePass);
  // 10.V U4: CockpitGrade ANTARA Bloom dan Output (flash kena filmic+bloom).
  const cockpitPass = createCockpitGradePass();
  composer.addPass(cockpitPass);
  const touchPass = createFinalTouchPass();
  composer.addPass(touchPass);
  const outputPass = new OutputPass(); // menangani tone mapping di akhir
  composer.addPass(outputPass);
  ctx.composer = composer;
  ctx.bloomPass = bloomPass;
  ctx.gradePass = gradePass;
  ctx.cockpitPass = cockpitPass;
  ctx.touchPass = touchPass;
}
