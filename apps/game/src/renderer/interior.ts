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
import { makeHullAlbedo, makeRoughnessMap } from "./scene3d/materials";

/**
 * 10.V M1.4 — 3 material SHARED untuk seluruh interior (jangan bikin
 * material per-room: draw call + VRAM jebol). Material emissive identitas
 * (amber strip, window warm, habitat warm) DIPERTAHANKAN apa adanya.
 */
export interface InteriorMaterials {
  wall: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
}

export function createInteriorMaterials(texSize = 256): InteriorMaterials {
  const wall = new THREE.MeshStandardMaterial({
    color: threeColor(colors.struct), metalness: 0.72,
    map: makeHullAlbedo(colors.struct, 0x1A11, texSize),
    roughnessMap: makeRoughnessMap(0x1A12, 0.5, 0.7, texSize),
    roughness: 1.0,
    emissive: threeColor("#0a1424"), emissiveIntensity: 0.32,
  });
  const floor = new THREE.MeshStandardMaterial({
    color: threeColor("#0e1a2e"), metalness: 0.4,
    map: makeHullAlbedo("#0e1a2e", 0xF100, texSize),
    roughnessMap: makeRoughnessMap(0xF101, 0.8, 0.95, texSize),
    roughness: 1.0,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: threeColor(colors.structHigh), metalness: 0.74,
    map: makeHullAlbedo(colors.structHigh, 0x7E1A, texSize),
    roughnessMap: makeRoughnessMap(0x7E1B, 0.5, 0.7, texSize),
    roughness: 1.0,
  });
  return { wall, floor, trim };
}

export interface InteriorBuildResult {
  group: THREE.Group;
  corridor: THREE.Group;
  promenades: THREE.Group[];
  plaza: THREE.Group;
  habitats: THREE.Group[];
  hangar: THREE.Group;
  hangarDoors: [THREE.Mesh, THREE.Mesh];
  hangarLight: THREE.PointLight;
  hangarSlots: THREE.InstancedMesh;
  slotPositions: THREE.Vector3[];
  bazaarStalls: THREE.Group[];
  bazaarPositions: THREE.Vector3[];
  /** Walkable bounds for FPS collision (Box3 per corridor/promenade/plaza/habitat/hangar). */
  walkBounds: THREE.Box3[];
}

/**
 * Corridor spine — Box(4200,80,80) sepanjang keel, reuse material Fase 3.
 * Iris 1: panel lines + emissive strip + 8 window strips (warm #ffd9a0).
 */
function buildCorridor(kit: InteriorMaterials): { group: THREE.Group; walkBox: THREE.Box3 } {
  const g = new THREE.Group();
  g.name = "ark-corridor";

  // Shell + trim + floor = material shared M1.4. Amber + window warm
  // adalah identitas (emissive) — dipertahankan, bukan plastik.
  const shellMat = kit.wall;
  const shellHigh = kit.trim;
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

  // Floor — walkable, roughness TINGGI (0.8+, anti-lantai-kaca-kantor).
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(4190, 2, 78),
    kit.floor,
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
function buildPromenades(kit: InteriorMaterials): { groups: THREE.Group[]; walkBoxes: THREE.Box3[] } {
  const groups: THREE.Group[] = [];
  const walkBoxes: THREE.Box3[] = [];

  const steelHigh = kit.trim;
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

    // Walkway — torus walkable (lantai shared, roughness tinggi).
    const walkway = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 18, 12, 64),
      kit.floor,
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

function buildPlaza(kit: InteriorMaterials): { group: THREE.Group; walkBox: THREE.Box3 } {
  const g = new THREE.Group();
  g.name = "ark-plaza";
  const steelHigh = kit.trim;
  const amber = new THREE.MeshStandardMaterial({
    color: threeColor(colors.tactical),
    emissive: threeColor(colors.tactical),
    emissiveIntensity: 1.2,
  });

  // Plaza central — Cylinder(400,400,20,48) di tengah hull, tempat kumpul
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(400, 400, 20, 48),
    kit.floor,
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

function buildHabitats(kit: InteriorMaterials): { groups: THREE.Group[]; walkBoxes: THREE.Box3[] } {
  const groups: THREE.Group[] = [];
  const walkBoxes: THREE.Box3[] = [];
  const steelHigh = kit.trim;
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

function buildBazaarStalls(): { groups: THREE.Group[]; positions: THREE.Vector3[] } {
  const groups: THREE.Group[] = [];
  const positions: THREE.Vector3[] = [];
  const stallMat = new THREE.MeshStandardMaterial({
    color: threeColor(colors.structHigh),
    metalness: 0.72,
    roughness: 0.4,
    emissive: threeColor(colors.tactical),
    emissiveIntensity: 0.35,
  });
  // 4 per ring × 4 ring = 16
  for (let r = 0; r < 4; r++) {
    const radius = 640 + r * 46;
    const cx = -400 + r * 500;
    for (let s = 0; s < 4; s++) {
      const ang = (s / 4) * Math.PI * 2 + (r * 0.2);
      const x = cx + Math.cos(ang) * (radius + 38);
      const z = Math.sin(ang) * (radius + 38);
      const g = new THREE.Group();
      g.name = `bazaar-stall-${r}-${s}`;
      const box = new THREE.Mesh(new THREE.BoxGeometry(40, 30, 40), stallMat);
      box.position.set(x, 15, z);
      g.add(box);
      // Signage sprite
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(), color: threeColor(colors.tactical), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      spr.position.set(x, 32, z);
      spr.scale.set(22, 10, 1);
      g.add(spr);
      groups.push(g);
      positions.push(new THREE.Vector3(x, 0, z));
    }
  }
  return { groups, positions };
}

/**
 * Iris 1-2 builder — corridor + 4 promenade + plaza + 96 habitat (24×4).
 * Hangar + bazaar menyusul iris 3+. Return group + walkBounds buat FPS.
 */
export function buildArkInterior(texSize = 256): InteriorBuildResult {
  const g = new THREE.Group();
  g.name = "ark-interior-iris2";

  // 10.V M1.4 — SATU kit shared untuk seluruh interior.
  const kit = createInteriorMaterials(texSize);

  const { group: corridor, walkBox: corridorBox } = buildCorridor(kit);
  g.add(corridor);

  const { groups: promenades, walkBoxes: promBoxes } = buildPromenades(kit);
  for (const pr of promenades) g.add(pr);

  const { group: plaza, walkBox: plazaBox } = buildPlaza(kit);
  g.add(plaza);

  const { groups: habitats, walkBoxes: habBoxes } = buildHabitats(kit);
  for (const h of habitats) g.add(h);

  // Fase 10 — Hangar Bay 32 slot (hull tengah, 400×200×600)
  const hangarGroup = new THREE.Group();
  hangarGroup.name = "ark-hangar";
  // SATU clone yang dibenarkan: BackSide adalah property material, tidak
  // bisa berbagi dengan wall yang FrontSide. Selain side, isinya sama —
  // tekstur + roughness sama (tetap anti-plastik).
  const hangarMat = kit.wall.clone();
  hangarMat.side = THREE.BackSide;
  const hangarShell = new THREE.Mesh(new THREE.BoxGeometry(400, 200, 600), hangarMat);
  hangarShell.position.set(200, -60, 0);
  hangarGroup.add(hangarShell);
  // Bay door — 2 panel
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(200, 180, 8), new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), metalness: 0.75 }));
  doorL.position.set(200, -20, -306);
  hangarGroup.add(doorL);
  const doorR = doorL.clone();
  doorR.position.set(200, -100, -306);
  hangarGroup.add(doorR);
  // Light sweep — PointLight di atas bay
  const bayLight = new THREE.PointLight(threeColor(colors.tactical), 0, 800, 1.5);
  bayLight.position.set(200, 40, -250);
  hangarGroup.add(bayLight);
  // 32 slot — 4×8 grid, tiap Box(60,20,80) + marker amber
  const slotGeom = new THREE.BoxGeometry(60, 2, 80);
  const slotInst = new THREE.InstancedMesh(slotGeom, kit.floor, 32);
  const dummy = new THREE.Object3D();
  const slotPositions: THREE.Vector3[] = [];
  for (let i = 0; i < 32; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const x = 80 + col * 62;
    const z = -220 + row * 110;
    dummy.position.set(x, -158, z);
    dummy.updateMatrix();
    slotInst.setMatrixAt(i, dummy.matrix);
    slotPositions.push(new THREE.Vector3(x, -148, z));
  }
  slotInst.instanceMatrix.needsUpdate = true;
  hangarGroup.add(slotInst);
  // Marker light per slot (tiny sprite)
  const slotMarkers: THREE.Sprite[] = [];
  const markerTex = makeGlowTexture();
  for (let i = 0; i < 32; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex, color: threeColor(colors.tactical), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    spr.position.copy(slotPositions[i]);
    spr.position.y = -150;
    spr.scale.set(14, 14, 1);
    hangarGroup.add(spr);
    slotMarkers.push(spr);
  }
  g.add(hangarGroup);
  // Walk bounds — hangar interior (besar)
  const hangarBox = new THREE.Box3(new THREE.Vector3(0, -160, -300), new THREE.Vector3(400, 40, 300));

  // Fase 11 — Bazaar 16 stall (4 per ring ×4) di promenade
  const { groups: bazaarStalls, positions: bazaarPositions } = buildBazaarStalls();
  for (const b of bazaarStalls) g.add(b);

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
    hangar: hangarGroup,
    hangarDoors: [doorL, doorR] as [THREE.Mesh, THREE.Mesh],
    hangarLight: bayLight,
    hangarSlots: slotInst,
    slotPositions,
    bazaarStalls,
    bazaarPositions,
    walkBounds: [corridorBox, ...promBoxes, plazaBox, ...habBoxes, hangarBox],
  };
}

export interface StadiumConfig {
  name: string;
  rings?: number;
  habitatsPerRing?: number;
  dockingPerRing?: number;
  communityId?: string;
}

export function buildStadiumFromConfig(cfg: StadiumConfig): THREE.Group {
  const g = new THREE.Group();
  g.name = `stadium-${cfg.name}`;
  const rings = cfg.rings ?? 4;
  const habitatsPerRing = cfg.habitatsPerRing ?? 24;
  const dockingPerRing = cfg.dockingPerRing ?? 12;
  const steelHigh = new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), metalness: 0.74, roughness: 0.36 });
  const amber = new THREE.MeshStandardMaterial({ color: threeColor(colors.tactical), emissive: threeColor(colors.tactical), emissiveIntensity: 1.2 });
  for (let r = 0; r < rings; r++) {
    const radius = 640 + r * 46;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 26, 16, 72), r === 1 ? amber : steelHigh);
    ring.rotation.x = 1.2 + r * 0.08;
    ring.position.x = -400 + r * 500;
    g.add(ring);
    // habitats
    const habGeom = new THREE.BoxGeometry(30, 18, 26);
    const habMat = new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), metalness: 0.72, roughness: 0.4 });
    const dummy = new THREE.Object3D();
    const habMesh = new THREE.InstancedMesh(habGeom, habMat, habitatsPerRing);
    for (let i = 0; i < habitatsPerRing; i++) {
      const ang = (i / habitatsPerRing) * Math.PI * 2;
      dummy.position.set((-400 + r * 500) + Math.cos(ang) * (radius - 12), Math.sin(ang) * (radius - 12), 0);
      dummy.rotation.set(0, 0, ang + Math.PI / 2);
      dummy.updateMatrix();
      habMesh.setMatrixAt(i, dummy.matrix);
    }
    habMesh.instanceMatrix.needsUpdate = true;
    g.add(habMesh);
    // docking per ring — small boxes
    for (let d = 0; d < dockingPerRing; d++) {
      const ang = (d / dockingPerRing) * Math.PI * 2;
      const port = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 8), steelHigh);
      port.position.set((-400 + r * 500) + Math.cos(ang) * (radius + 18), Math.sin(ang) * (radius + 18), 0);
      g.add(port);
    }
  }
  return g;
}
