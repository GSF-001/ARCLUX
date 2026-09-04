// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/quality.ts — settings → scene live (satu source of truth).
// GameSettings tetap datang dari luar (settings.ts). Moved verbatim dari
// scene3d.ts — rebuild density/detail via builder tiap domain.

import * as THREE from "three";
import { effPixelRatio, type GameSettings } from "../settings";
import type { SceneContext } from "./bootstrap";
import { buildNebula } from "./nebula";
import { buildSuns } from "./suns";
import { buildPlanetSystem } from "./planets";
import { buildBelt } from "./belt";

/** Terapkan settings ke renderer aktif — pixel ratio, bloom, tone mapping, rebuild. */
export function applyQuality(ctx: SceneContext, s: GameSettings): void {
  ctx.settings = s;
  const { renderer, composer, bloomPass, DPR } = ctx;
  renderer.setPixelRatio(effPixelRatio(s, DPR));
  renderer.setSize(ctx.width, ctx.height);
  composer?.setSize(ctx.width, ctx.height);
  if (bloomPass) {
    bloomPass.resolution.set(ctx.width * s.resolutionScale, ctx.height * s.resolutionScale);
    const bloomEnabled = s.bloom !== "off";
    bloomPass.enabled = bloomEnabled;
    bloomPass.strength = s.bloom === "high" ? 1.2 : 0.65;
  }
  if (s.toneMapping === "AGX") renderer.toneMapping = THREE.AgXToneMapping;
  else if (s.toneMapping === "REINHARD") renderer.toneMapping = THREE.ReinhardToneMapping;
  else renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Density & detail rebuild
  if (s.nebulaDensity !== ctx.nebulaSprites.length) buildNebula(ctx, Math.min(12, s.nebulaDensity));
  if (s.starBodies !== ctx.starBodies) { ctx.starBodies = s.starBodies; buildSuns(ctx, Math.max(1, Math.min(3, ctx.starBodies))); }
  if (s.planetCount !== ctx.planetCount) { ctx.planetCount = s.planetCount; buildPlanetSystem(ctx, ctx.planetCount, s.planetDetail); }
  if (s.beltDensity !== ctx.beltCount) { ctx.beltCount = s.beltDensity; buildBelt(ctx, ctx.beltCount); }
}
