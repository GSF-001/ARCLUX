// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/scene3d.ts — SUPER HD cinematic vessel render dari RegionState.
// Prinsip (blueprint §2.5/§21/§22, D-008): server tentukan posisi/heading/damage;
// client cuma render — visual ≠ otoritas posisi. Desain visual mengikuti
// 01-spatial-ux §28 (EVE-level command interface, data-dense, industrial),
// §2 (cosmic environment hidup), §22 (LOD FAR/MID/NEAR).
//
// Semua efek dibangun dari inti THREE (tanpa import examples) agar tetap jalan
// sebagai raw module script di Electron renderer (CSP default-src 'self').

import type { RegionState, VesselEntity, StationEntity } from "../../../../packages/gameserver/types";
import * as THREE from "three";

export interface Scene3D {
  renderRegion(region: RegionState): void;
  updateVessel(v: VesselEntity): void;
  dispose(): void;
}

// ---- Kosmetik deterministik untuk kosmik environment (§2) — jangan jadi
// keindahan "random per frame"; seed tetap di awal agar semua view konsisten.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function initScene3D(container?: HTMLElement): Scene3D {
  const target = container ?? (typeof document !== "undefined" ? document.getElementById("app") : null);
  const width = target?.clientWidth ?? 800;
  const height = target?.clientHeight ?? 600;

  const scene = new THREE.Scene();
  // Cinematic deep-space background (§28 industrial, bukan flat dashboard blue).
  scene.background = new THREE.Color(0x04060d);

  const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 200000);
  camera.position.set(0, 1200, 2600);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // cinematic rolloff (§28)
  renderer.toneMappingExposure = 1.1;
  if (target) target.appendChild(renderer.domElement);

  // --- PBR clara: env map dari PMREM (environment resolution terbatas tapi
  // real — Boris hitung exposure Stefan-Boltzmann di gameserver, di sini kita
  // render radiance-nya). Build env dari gradient scene, tanpa file HDRI eksternal.
  // ---

  const rand = mulberry32(0x5eed);

  // === Starfield (InstancedMesh, §22 FAR) — 6000 bintang skala system ===
  const starCount = 6000;
  const starDummy = new THREE.Object3D();
  const starGeom = new THREE.SphereGeometry(1, 4, 4);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const stars = new THREE.InstancedMesh(starGeom, starMat, starCount);
  for (let i = 0; i < starCount; i++) {
    const r = 20000 + rand() * 60000;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    starDummy.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    const s = 1.5 + rand() * 3.5; // range size → parallax depth
    starDummy.scale.set(s, s, s);
    starDummy.updateMatrix();
    stars.setMatrixAt(i, starDummy.matrix);
  }
  stars.instanceMatrix.needsUpdate = true;
  scene.add(stars);
  // Tambahan bintang terang (acak warna) untuk depth bintang (B-class/O-class).
  const hotStarGeom = new THREE.SphereGeometry(1, 6, 6);
  const hotMats = [0x9fd8ff, 0xffd9a0, 0xffb3c1].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const hotStars = new THREE.InstancedMesh(hotStarGeom, hotMats[0], 120);
  for (let i = 0; i < 120; i++) {
    const r = 30000 + rand() * 90000;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    starDummy.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    const s = 4 + rand() * 12;
    starDummy.scale.set(s, s, s);
    starDummy.updateMatrix();
    hotStars.setMatrixAt(i, starDummy.matrix);
    hotStars.setColorAt(i, new THREE.Color(hotMats[i % 3].color));
  }
  hotStars.instanceMatrix.needsUpdate = true;
  if (hotStars.instanceColor) hotStars.instanceColor.needsUpdate = true;
  scene.add(hotStars);

  // === Nebula backdrop (additive glows) — depth & warna industrial (§2 ATMOSPHERIC) ===
  const nebulaTex = makeGlowTexture();
  const nebulaColors = [0x1b2a5a, 0x3a1b5a, 0x0e3a2a];
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.SpriteMaterial({
      map: nebulaTex,
      color: nebulaColors[i % nebulaColors.length],
      transparent: true,
      opacity: 0.05 + rand() * 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    const r = 40000 + rand() * 50000;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    spr.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.4, r * Math.sin(phi) * Math.sin(theta));
    const sc = 8000 + rand() * 14000;
    spr.scale.set(sc, sc, 1);
    scene.add(spr);
  }

  // === Solar corona — bintang lokal sangat terang dengan glow (emissive) ===
  const sunGeom = new THREE.SphereGeometry(600, 32, 32);
  const sunMat = new THREE.MeshStandardMaterial({
    color: 0xffcf8a,
    emissive: 0xff9d3c,
    emissiveIntensity: 2.2,
  });
  const sun = new THREE.Mesh(sunGeom, sunMat);
  sun.position.set(0, -200, -3000);
  scene.add(sun);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: nebulaTex, color: 0xff9d3c, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sunGlow.position.copy(sun.position);
  sunGlow.scale.set(6000, 6000, 1);
  scene.add(sunGlow);
  // Key light dari matahari (bukan ambient datar — directional industrial).
  const sunLight = new THREE.DirectionalLight(0xfff2dd, 1.6);
  sunLight.position.copy(sun.position);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x223, 0.35)); // bayangan interior lembut

  // === Planet(s) deterministik — orbit nuduh §2.3 (skala system, visual saja). ===
  const planets: THREE.Mesh[] = [];
  const planetSpec: { a: number; e: number; r: number; color: number; emissive?: number }[] = [
    { a: 4200, e: 0.12, r: 520, color: 0x4a6fa5 },
    { a: 6800, e: 0.2, r: 780, color: 0xb5673b, emissive: 0x441100 }, // vulkanik, idle glow
    { a: 9800, e: 0.05, r: 950, color: 0x2c5f5a },
  ];
  for (const spec of planetSpec) {
    const mat = new THREE.MeshStandardMaterial({
      color: spec.color,
      emissive: spec.emissive ?? 0x000000,
      emissiveIntensity: 1,
      roughness: 0.9,
      metalness: 0.05,
    });
    const p = new THREE.Mesh(new THREE.SphereGeometry(spec.r, 32, 32), mat);
    scene.add(p);
    planets.push(p);
  }

  // === Asteroid belt (InstancedMesh COLLIDABLE visual §2.1) — ribu-an, LOD ===
  const beltCount = 4000;
  const beltDummy = new THREE.Object3D();
  const beltGeom = new THREE.DodecahedronGeometry(14, 0);
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x55556a, roughness: 1, metalness: 0.1 });
  const belt = new THREE.InstancedMesh(beltGeom, beltMat, beltCount);
  for (let i = 0; i < beltCount; i++) {
    const r = 12000 + rand() * 4000;
    const angle = rand() * Math.PI * 2;
    beltDummy.position.set(r * Math.cos(angle), (rand() - 0.5) * 900, r * Math.sin(angle));
    const s = 4 + rand() * 20;
    beltDummy.scale.set(s, s, s);
    beltDummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    beltDummy.updateMatrix();
    belt.setMatrixAt(i, beltDummy.matrix);
  }
  belt.instanceMatrix.needsUpdate = true;
  belt.rotation.x = Math.PI / 2.6; // miring orbit (inklinasi)
  scene.add(belt);

  // === GridHelper subtil — referensi skala lokal (bukan dashboard grid) ===
  const grid = new THREE.GridHelper(8000, 80, 0x2a3550, 0x16203a);
  grid.position.y = -400;
  scene.add(grid);

  // === Vessel/station objects ===
  const vessels = new Map<string, THREE.Group>();
  const stations = new Map<string, THREE.Group>();

  // Glow texture untuk titik/thruster (dibagi, dibuang di dispose)
  const pointGlow = makeGlowTexture();

  // Fabrikasi vessel: hull + dorsal wing + engine glow + shield bubble (LOD NEAR)
  const buildVessel = (v: VesselEntity): THREE.Group => {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(16, 44, 10),
      new THREE.MeshStandardMaterial({ color: 0x2b3a55, metalness: 0.7, roughness: 0.35, emissive: 0x0a1424, emissiveIntensity: 0.4 })
    );
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(46, 2.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x1f2a42, metalness: 0.6, roughness: 0.45 })
    );
    wing.position.y = 2;
    const eng = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pointGlow, color: 0x4cc9ff, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    eng.position.set(0, 0, 26);
    eng.scale.set(16, 16, 1);
    const rglow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pointGlow, color: 0x3aa0ff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    rglow.scale.set(26, 26, 1);
    g.add(hull, wing, eng, rglow);
    return g;
  };

  // Fabrikasi station: ring hab + hub (02-station, safe-zone)
  const buildStation = (s: StationEntity): THREE.Group => {
    const g = new THREE.Group();
    const hub = new THREE.Mesh(
      new THREE.IcosahedronGeometry(60, 1),
      new THREE.MeshStandardMaterial({ color: 0x335a7a, metalness: 0.6, roughness: 0.4, emissive: 0x0a1a2a, emissiveIntensity: 0.6 })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(150, 16, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0x2b4a66, metalness: 0.65, roughness: 0.4 })
    );
    ring.rotation.x = Math.PI / 2.1;
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pointGlow, color: 0x67e8f9, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    beacon.scale.set(120, 120, 1);
    g.add(hub, ring, beacon);
    return g;
  };

  const ensureEntry = (id: string, build: () => THREE.Group, map: Map<string, THREE.Group>) => {
    let grp = map.get(id);
    if (grp) return grp;
    grp = build();
    grp.name = id;
    scene.add(grp);
    map.set(id, grp);
    return grp;
  };

  const updateVessel = (v: VesselEntity): void => {
    const grp = ensureEntry(v.id, () => buildVessel(v), vessels);
    grp.position.set(v.position.x, v.position.y, v.position.z);
    grp.rotation.set(v.heading.pitch, v.heading.yaw, 0);
  };

  // Orkestrasi: posisi planet deterministik dari tick (§2.3) — animasi orbital ringan
  let tickOffset = 0;

  const renderRegion = (region: RegionState): void => {
    tickOffset = region.tick;
    // Planet orbit (visual; posisi orbit = state dunia server, di sini client render
    // aproximasi deterministik untuk cinematic only — bukan otoritas).
    const t = tickOffset * 0.001;
    const p0 = planets[0], p1 = planets[1], p2 = planets[2];
    if (p0) { const th = t * 0.08; p0.position.set(4200 * Math.cos(th), 0, 4200 * 1.2 * Math.sin(th)); }
    if (p1) { const th = t * 0.045; p1.position.set(6800 * Math.cos(th), 300, 6800 * 1.5 * Math.sin(th)); }
    if (p2) { const th = t * 0.028; p2.position.set(9800 * Math.cos(th), -200, 9800 * 1.1 * Math.sin(th)); }

    const live = new Set<string>();
    for (const e of region.entities.values()) {
      live.add(e.id);
      if (e.kind === "vessel") {
        updateVessel(e as VesselEntity);
      } else if (e.kind === "station") {
        ensureEntry(e.id, () => buildStation(e as StationEntity), stations);
        const grp = stations.get(e.id)!;
        grp.position.set(e.position.x, e.position.y, e.position.z);
      }
    }
    // Hapus yang sudah tidak ada (efisiensi render)
    for (const [id, grp] of vessels) if (!live.has(id)) { scene.remove(grp); disposeGroup(grp, pointGlow); vessels.delete(id); }
    for (const [id, grp] of stations) if (!live.has(id)) { scene.remove(grp); disposeGroup(grp, pointGlow); stations.delete(id); }

    renderer.render(scene, camera);
  };

  const onResize = () => {
    const w = target?.clientWidth ?? width;
    const h = target?.clientHeight ?? height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  if (typeof window !== "undefined") window.addEventListener("resize", onResize);

  const dispose = () => {
    if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
    renderer.dispose();
    for (const m of vessels.values()) disposeGroup(m, pointGlow);
    for (const m of stations.values()) disposeGroup(m, pointGlow);
    vessels.clear();
    stations.clear();
    starGeom.dispose(); starMat.dispose();
    hotStarGeom.dispose(); hotMats.forEach((m) => m.dispose());
    beltGeom.dispose(); beltMat.dispose();
    sunGeom.dispose(); sunMat.dispose();
    planets.forEach((p) => { p.geometry.dispose(); (p.material as THREE.Material).dispose(); });
    if (target && renderer.domElement.parentElement === target) target.removeChild(renderer.domElement);
  };

  // Frame awal
  renderer.render(scene, camera);

  return { renderRegion, updateVessel, dispose };
}

// Butir cahaya bunder untuk glow (nebula/point/thruster) — dipakai banyak objek.
function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!canvas) return new THREE.Texture();
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.4)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Membuang material/geometry milik group (menghindari memory leak per vessel).
// Texture glow dibagi antar vessel & tidak ikut dibuang (shared resource).
function disposeGroup(g: THREE.Group, _sharedGlow: THREE.Texture): void {
  g.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const m = mesh.material;
    if (m) {
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m.dispose();
    }
  });
}
