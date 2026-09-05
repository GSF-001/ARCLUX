// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// interior.ts — FPS walkable interior world (Fase 8, iris 1-2).
// Genshin-like, bukan click-to-move murah. Skala EVE/Star Citizen, lazy-load
// pas docking (exterior visible=false). Iris 1: corridor+promenade. Iris 2:
// plaza central + habitat 24 per ring (bisa masuk, bukan InstancedMesh luar).

import * as THREE from "three";
import { colors, threeColor } from "../ui/tokens";
import { makeGlowTexture } from "./scene3d/bootstrap";

export interface InteriorBuildResult {
  group: THREE.Group;
  corridor: THREE.Group;
  promenades: THREE.Group[];
  plaza: THREE.Group;
  habitats: THREE.Group[];
  /** Walkable bounds for FPS collision (Box3 per corridor/promenade/plaza/habitat). */
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

function buildPlaza(): { group: THREE.Group; walkBox: THREE.Box3 } {
  const g = new THREE.Group();
  g.name = "ark-plaza";
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

  // Plaza central — Cylinder(400,400,20,48) di tengah hull, tempat kumpul
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(400, 400, 20, 48),
    new THREE.MeshStandardMaterial({ color: threeColor("#0e1a2e"), metalness: 0.45, roughness: 0.82 }),
  );
  deck.position.set(0, -10, 0);
  g.add(deck);

  // Ring trim + hazard outer
  const trim = new THREE.Mesh(new THREE.TorusGeometry(400, 2.2, 12, 64), steelHigh);
  trim.rotation.x = Math.PI / 2;
  trim.position.set(0, 1, 0);
  g.add(trim);
  const outer = new THREE.Mesh(new THREE.TorusGeometry(398, 0.9, 8, 64), amber);
  outer.rotation.x = Math.PI / 2;
  outer.position.set(0, 1.1, 0);
  g.add(outer);

  // 4 pillar kecil di cardinal
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 42, 8), steelHigh);
    pillar.position.set(Math.cos(ang) * 360, 12, Math.sin(ang) * 360);
    g.add(pillar);
  }

  // Safe zone hint — subtle glow di tengah (Bukan gameplay, visual doang)
  const glowTex = makeGlowTexture();
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: threeColor(colors.tech),
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.position.set(0, 22, 0);
  glow.scale.set(520, 520, 1);
  g.add(glow);

  const walkBox = new THREE.Box3(new THREE.Vector3(-380, -10, -380), new THREE.Vector3(380, 24, 380));
  return { group: g, walkBox };
}

function buildHabitats(): { groups: THREE.Group[]; walkBoxes: THREE.Box3[] } {
  const groups: THREE.Group[] = [];
  const walkBoxes: THREE.Box3[] = [];
  const steelHigh = new THREE.MeshStandardMaterial({
    color: threeColor(colors.structHigh),
    metalness: 0.74,
    roughness: 0.36,
  });
  const habitatMat = new THREE.MeshStandardMaterial({
    color: threeColor(colors.structHigh),
    metalness: 0.72,
    roughness: 0.4,
    emissive: threeColor("#ffb36b"),
    emissiveIntensity: 0.42,
  });
  const windowWarm = new THREE.MeshStandardMaterial({
    color: threeColor("#ffd9a0"),
    emissive: threeColor("#ffd9a0"),
    emissiveIntensity: 1.5,
  });

  for (let r = 0; r < 4; r++) {
    const radius = 640 + r * 46;
    const cx = -400 + r * 500;
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const x = cx + Math.cos(ang) * (radius - 14);
      const z = Math.sin(ang) * (radius - 14);
      const g = new THREE.Group();
      g.name = `ark-habitat-${r}-${i}`;
      // Habitat — Box(30,18,26) beneran ruangan (bisa masuk)
      const shell = new THREE.Mesh(new THREE.BoxGeometry(30, 18, 26), habitatMat);
      shell.position.set(x, 9, z);
      shell.rotation.y = -ang;
      g.add(shell);
      // Pintu — dark
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(8, 10, 1),
        new THREE.MeshStandardMaterial({ color: threeColor("#060a14"), roughness: 1 }),
      );
      door.position.set(x + Math.cos(ang) * 13, 5, z + Math.sin(ang) * 13);
      door.rotation.y = -ang;
      g.add(door);
      // Jendela warm 2 per habitat
      for (const side of [-1, 1]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.6), windowWarm);
        win.position.set(x + Math.cos(ang + side * 0.35) * 14, 11, z + Math.sin(ang + side * 0.35) * 14);
        win.rotation.y = -ang;
        g.add(win);
      }
      // Walk bounds — habitat interior (kecil, presisi)
      const min = new THREE.Vector3(x - 13, 0, z - 11);
      const max = new THREE.Vector3(x + 13, 18, z + 11);
      groups.push(g);
      walkBoxes.push(new THREE.Box3(min, max));
    }
  }
  return { groups, walkBoxes };
}

/**
 * Iris 1-2 builder — corridor + 4 promenade + plaza + 96 habitat (24×4).
 * Hangar + bazaar menyusul iris 3+. Return group + walkBounds buat FPS.
 */
export function buildArkInterior(): InteriorBuildResult {
  const g = new THREE.Group();
  g.name = "ark-interior-iris2";

  const { group: corridor, walkBox: corridorBox } = buildCorridor();
  g.add(corridor);

  const { groups: promenades, walkBoxes: promBoxes } = buildPromenades();
  for (const pr of promenades) g.add(pr);

  const { group: plaza, walkBox: plazaBox } = buildPlaza();
  g.add(plaza);

  const { groups: habitats, walkBoxes: habBoxes } = buildHabitats();
  for (const h of habitats) g.add(h);

  // Iris 3: Lighting — Ambient + Point per deck + emissive reuse PMREM Fase 1
  // PMREM scene.environment tetap (reuse, bukan bikin baru). Interior cuma
  // tambah light biar gak gelap gulita pas exterior visible=false.
  const ambient = new THREE.AmbientLight(threeColor(colors.struct), 0.85);
  g.add(ambient);
  // Point per deck — corridor 3 + plaza 1 + promenade 4
  const lightPositions: [number, number, number][] = [
    [-1400, 18, 0],
    [0, 18, 0],
    [1400, 18, 0],
    [0, 12, 0], // plaza
  ];
  // promenade centers
  for (let r = 0; r < 4; r++) lightPositions.push([-400 + r * 500, 14, 0]);
  for (const [x, y, z] of lightPositions) {
    const p = new THREE.PointLight(threeColor("#ffd9a0"), 0.55, 900, 1.8);
    p.position.set(x, y, z);
    g.add(p);
  }
  // Emissive boost — already on windowWarm/habitat mats, tinggal pastiin
  // scene.environment (PMREM Fase 1) kepake pas exterior dimatiin. Gak bikin
  // PMREM baru — hemat 10-frame cost.

  // Subtle glow di corridor (reuse makeGlowTexture biar hemat)
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
    plaza,
    habitats,
    walkBounds: [corridorBox, ...promBoxes, plazaBox, ...habBoxes],
  };
}
