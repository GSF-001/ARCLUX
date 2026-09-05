// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// interior.ts — FPS walkable interior world (Fase 8, iris 1: corridor + promenade).
// Genshin-like, bukan click-to-move murah. Skala EVE/Star Citizen, lazy-load
// pas docking (exterior visible=false). Iris 1: corridor spine + promenade
// 4 ring. Iris 2: plaza+habitat, dst. — dipecah biar presisi kecil-kecil.

import * as THREE from "three";
import { colors, threeColor } from "../ui/tokens";
import { makeGlowTexture } from "./scene3d/bootstrap";

export interface InteriorBuildResult {
  group: THREE.Group;
  corridor: THREE.Group;
  promenades: THREE.Group[];
  /** Walkable bounds for FPS collision (Box3 per corridor/promenade). */
  walkBounds: THREE.Box3[];
}

/**
 * Corridor spine — Box(4200,80,80) sepanjang keel, reuse material Fase 3.
 * Iris 1: panel lines + emissive strip + 8 window strips (warm #ffd9a0).
 */
function buildCorridor(): { group: THREE.Group; walkBox: THREE.Box3 } {
  const g = new THREE.Group();
  g.name = "ark-corridor";

  // Shell — hollow feeling via dark interior + amber frame
  const shellMat = new THREE.MeshStandardMaterial({
    color: threeColor(colors.struct),
    metalness: 0.72,
    roughness: 0.42,
    emissive: threeColor("#0a1424"),
    emissiveIntensity: 0.32,
  });
  const shellHigh = new THREE.MeshStandardMaterial({
    color: threeColor(colors.structHigh),
    metalness: 0.74,
    roughness: 0.36,
  });
  const amber = new THREE.MeshStandardMaterial({
    color: threeColor(colors.tactical),
    emissive: threeColor(colors.tactical),
    emissiveIntensity: 1.3,
  });
  const windowWarm = new THREE.MeshStandardMaterial({
    color: threeColor("#ffd9a0"),
    emissive: threeColor("#ffd9a0"),
    emissiveIntensity: 1.6,
  });

  // Main corridor — along X (keel), centered at 0
  const body = new THREE.Mesh(new THREE.BoxGeometry(4200, 80, 80), shellMat);
  body.position.set(0, 0, 0);
  g.add(body);

  // 12 panel lines (reuse Fase 3.1 pattern) + emissive strip
  for (let i = 0; i < 12; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3800, 1.1, 4), shellHigh);
    panel.position.set(0, 38 + (i % 3) * 10 * (i < 6 ? 1 : -1), -12 + (i % 4) * 8);
    g.add(panel);
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(4180, 0.9, 1.8), amber);
  strip.position.set(0, 39, 0);
  g.add(strip);

  // 8 window strips (ada di luar juga — dari dalam tetap warm)
  for (let i = 0; i < 8; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(160, 3.5, 1.2), windowWarm);
    win.position.set(-1550 + i * 440, 28, 40.5);
    g.add(win);
    const win2 = win.clone();
    win2.position.set(-1550 + i * 440, 28, -40.5);
    g.add(win2);
  }

  // Floor — walkable, slight metal
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(4190, 2, 78),
    new THREE.MeshStandardMaterial({ color: threeColor("#0e1a2e"), metalness: 0.4, roughness: 0.85 }),
  );
  floor.position.set(0, -39, 0);
  g.add(floor);

  // Walk bounds — corridor interior (shrink 2m dari wall)
  const walkBox = new THREE.Box3(
    new THREE.Vector3(-2090, -38, -38),
    new THREE.Vector3(2090, 38, 38),
  );

  return { group: g, walkBox };
}

/**
 * Promenade 4 ring — walkway melingkar di tiap ring (radius 640-760 reuse
 * Fase 3.5), guard rail + hazard stripe, 96 windows warm tetap.
 */
function buildPromenades(): { groups: THREE.Group[]; walkBoxes: THREE.Box3[] } {
  const groups: THREE.Group[] = [];
  const walkBoxes: THREE.Box3[] = [];

  const steelHigh = new THREE.MeshStandardMaterial({
    color: threeColor(colors.structHigh),
    metalness: 0.74,
    roughness: 0.36,
  });
  const amber = new THREE.MeshStandardMaterial({
    color: threeColor(colors.tactical),
    emissive: threeColor(colors.tactical),
    emissiveIntensity: 1.2,
  });

  for (let r = 0; r < 4; r++) {
    const rg = new THREE.Group();
    rg.name = `ark-promenade-${r}`;
    const radius = 640 + r * 46;
    const cx = -400 + r * 500;

    // Walkway — torus walkable (reuse torus, thickness 18)
    const walkway = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 18, 12, 64),
      new THREE.MeshStandardMaterial({ color: threeColor("#0e1a2e"), metalness: 0.38, roughness: 0.88 }),
    );
    walkway.rotation.x = Math.PI / 2;
    walkway.position.set(cx, 0, 0);
    rg.add(walkway);

    // Guard rail — inner + outer ring
    for (const off of [-18, 18]) {
      const rail = new THREE.Mesh(
        new THREE.TorusGeometry(radius + off, 1.4, 8, 64),
        steelHigh,
      );
      rail.rotation.x = Math.PI / 2;
      rail.position.set(cx, 6, 0);
      rg.add(rail);
    }

    // Hazard stripe — torus tipis di atas walkway
    const stripe = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.7, 8, 64),
      amber,
    );
    stripe.rotation.x = Math.PI / 2;
    stripe.position.set(cx, 1.2, 0);
    rg.add(stripe);

    groups.push(rg);

    // Walk bounds — ring walkway (approx AABB, cukup buat Box3 test iris 1)
    const min = new THREE.Vector3(cx - radius - 22, -2, -radius - 22);
    const max = new THREE.Vector3(cx + radius + 22, 22, radius + 22);
    walkBoxes.push(new THREE.Box3(min, max));
  }

  return { groups, walkBoxes };
}

/**
 * Iris 1 builder — corridor + 4 promenade, lazy-load pas docking.
 * Belum plaza/habitat/hangar (iris 2+). Return group + walkBounds buat FPS.
 */
export function buildArkInterior(): InteriorBuildResult {
  const g = new THREE.Group();
  g.name = "ark-interior-iris1";

  const { group: corridor, walkBox: corridorBox } = buildCorridor();
  g.add(corridor);

  const { groups: promenades, walkBoxes: promBoxes } = buildPromenades();
  for (const pr of promenades) g.add(pr);

  // Subtle glow di corridor ( reuse makeGlowTexture biar hemat)
  const glowTex = makeGlowTexture();
  for (const cx of [-1200, 0, 1200]) {
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: threeColor(colors.tactical),
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    spr.position.set(cx, 18, 0);
    spr.scale.set(180, 180, 1);
    g.add(spr);
  }

  return {
    group: g,
    corridor,
    promenades,
    walkBounds: [corridorBox, ...promBoxes],
  };
}
