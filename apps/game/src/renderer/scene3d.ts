// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/scene3d.ts — SUPER HD cinematic render (server-authoritative D-008:
// visual ≠ otoritas posisi). Desain game-native, bukan skin apps/web.
// Blueprint 01 §2.5 dua skala · §2.6 fisika (sun emissive ∝ aktivitas, planet termal) ·
// §22 LOD · §2.1) objek COLLIDABLE/ATMOSPHERIC/BACKDROP.
//
// KONSEP: Ark-Librarieschip — satu vessel-world raksasa tempat semua sejarah
// kembali (06 §18.5). Semua efek dari inti THREE (no examples import, raw module
// di Electron renderer, CSP default-src 'self').

import type { RegionState, VesselEntity, StationEntity } from "../../../../packages/gameserver/types";
import * as THREE from "three";
import { colors, threeColor, nebulaSeed } from "../ui/tokens";

export interface Scene3D {
  renderRegion(region: RegionState): void;
  updateVessel(v: VesselEntity): void;
  dispose(): void;
}

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
  scene.background = new THREE.Color(threeColor(colors.voidDeep));
  scene.fog = new THREE.FogExp2(threeColor(colors.void), 0.00004);

  const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 260000);
  camera.position.set(0, 2600, 5200);
  camera.lookAt(0, -200, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  if (target) target.appendChild(renderer.domElement);

  const rand = mulberry32(nebulaSeed);

  // ================= STARFIELD (InstancedMesh, §22 FAR) =================
  const starCount = 8000;
  const starDummy = new THREE.Object3D();
  const starGeom = new THREE.SphereGeometry(1, 4, 4);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const stars = new THREE.InstancedMesh(starGeom, starMat, starCount);
  for (let i = 0; i < starCount; i++) {
    const r = 30000 + rand() * 80000;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    starDummy.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    const s = 1 + rand() * 3;
    starDummy.scale.set(s, s, s);
    starDummy.updateMatrix();
    stars.setMatrixAt(i, starDummy.matrix);
  }
  stars.instanceMatrix.needsUpdate = true;
  scene.add(stars);

  // Bintang panas berwarna (depth, spectral accent)
  const hotGeom = new THREE.SphereGeometry(1, 6, 6);
  const hotMats = [colors.hotStarA, colors.hotStarB, colors.hotStarC].map((c) => new THREE.MeshBasicMaterial({ color: threeColor(c) }));
  const hotStars = new THREE.InstancedMesh(hotGeom, hotMats[0], 160);
  for (let i = 0; i < 160; i++) {
    const r = 45000 + rand() * 110000;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    starDummy.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    const s = 3 + rand() * 10;
    starDummy.scale.set(s, s, s);
    starDummy.updateMatrix();
    hotStars.setMatrixAt(i, starDummy.matrix);
    hotStars.setColorAt(i, new THREE.Color([colors.hotStarA, colors.hotStarB, colors.hotStarC][i % 3]));
  }
  hotStars.instanceMatrix.needsUpdate = true;
  if (hotStars.instanceColor) hotStars.instanceColor.needsUpdate = true;
  scene.add(hotStars);

  // ================= NEBULA — atmosferik depth (§2 ATMOSPHERIC) =================
  const nebulaTex = makeGlowTexture();
  const nebulaColors = ["#1b2a5a", "#3a1b5a", "#0e3a2a"];
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.SpriteMaterial({
      map: nebulaTex,
      color: nebulaColors[i % nebulaColors.length],
      transparent: true,
      opacity: 0.04 + rand() * 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    const r = 60000 + rand() * 60000;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    spr.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.4, r * Math.sin(phi) * Math.sin(theta));
    const sc = 10000 + rand() * 18000;
    spr.scale.set(sc, sc, 1);
    scene.add(spr);
  }

  // ================= SUN — sumber energi (02 §2.6, emissive ∝ aktivitas) =================
  const sunGeom = new THREE.SphereGeometry(900, 48, 48);
  const sunMat = new THREE.MeshStandardMaterial({
    color: threeColor(colors.sun),
    emissive: threeColor(colors.sunEmissive),
    emissiveIntensity: 2.4,
  });
  const sun = new THREE.Mesh(sunGeom, sunMat);
  sun.position.set(-6000, -400, 9000);
  scene.add(sun);

  const coronaTex = makeGlowTexture();
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: coronaTex, color: threeColor(colors.sunEmissive), transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sunGlow.position.copy(sun.position);
  sunGlow.scale.set(14000, 14000, 1);
  scene.add(sunGlow);

  const sunLight = new THREE.DirectionalLight(threeColor(colors.sunCore), 2.2);
  sunLight.position.copy(sun.position);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(threeColor(colors.struct), 0.4));

  // ================= PLANETS — orbit deterministik (§2.3) + termal =================
  const planets: THREE.Mesh[] = [];
  const planetSpec = [
    { a: 9000, e: 0.1, r: 700, color: colors.planetBlue, emissive: "#000000" },
    { a: 14000, e: 0.2, r: 1000, color: colors.planetVolcanic, emissive: colors.planetVolcanicGlow },
    { a: 20000, e: 0.05, r: 1200, color: colors.planetGreen, emissive: "#000000" },
  ];
  for (const spec of planetSpec) {
    const mat = new THREE.MeshStandardMaterial({
      color: threeColor(spec.color),
      emissive: threeColor(spec.emissive),
      emissiveIntensity: 1,
      roughness: 0.85,
      metalness: 0.05,
    });
    const p = new THREE.Mesh(new THREE.SphereGeometry(spec.r, 40, 40), mat);
    scene.add(p);
    // atmo glow (atmospheric §2)
    const atmo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coronaTex, color: threeColor(spec.color), transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    atmo.scale.set(spec.r * 3.4, spec.r * 3.4, 1);
    p.add(atmo);
    planets.push(p);
  }
  // Planet orbit radii (skala system)
  const orbitRadii = [9000, 14000, 20000];

  // ================= ASTEROID BELT (COLLIDABLE visual §2.1) =================
  const beltCount = 5000;
  const beltDummy = new THREE.Object3D();
  const beltGeom = new THREE.DodecahedronGeometry(14, 0);
  const beltMat = new THREE.MeshStandardMaterial({ color: threeColor(colors.belt), roughness: 1, metalness: 0.12 });
  const belt = new THREE.InstancedMesh(beltGeom, beltMat, beltCount);
  for (let i = 0; i < beltCount; i++) {
    const r = 26000 + rand() * 8000;
    const angle = rand() * Math.PI * 2;
    beltDummy.position.set(r * Math.cos(angle), (rand() - 0.5) * 1600, r * Math.sin(angle));
    const s = 4 + rand() * 22;
    beltDummy.scale.set(s, s, s);
    beltDummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    beltDummy.updateMatrix();
    belt.setMatrixAt(i, beltDummy.matrix);
  }
  belt.instanceMatrix.needsUpdate = true;
  belt.rotation.x = 1.1;
  scene.add(belt);

  // ================= ARK-LIBRARIESCHIP — vessel-world struktur (06 §18.5, 01 §15) ======
  // Skala 0,0 mid-scene, contoh permanen yang menampung sejarah. Struktur:
  // spar + hull + ring katedral (distrik) + spire pusat (central slot) + docking beacons.
  const ark = buildArkLibrary(); // returns position set at origin
  scene.add(ark.group);

  // ================= Local grid — referensi skala lokal (§2.5) =================
  const grid = new THREE.GridHelper(12000, 120, threeColor(colors.structHigh), threeColor(colors.struct));
  grid.position.y = -1600;
  scene.add(grid);

  // ================= Entities (vessel/station) =================
  const vessels = new Map<string, THREE.Group>();
  const stations = new Map<string, THREE.Group>();
  const pointGlow = makeGlowTexture();

  const buildVessel = (v: VesselEntity): THREE.Group => {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(18, 52, 10),
      new THREE.MeshStandardMaterial({ color: threeColor(colors.hull), metalness: 0.7, roughness: 0.35, emissive: threeColor("#0a1424"), emissiveIntensity: 0.5 })
    );
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(54, 3, 14),
      new THREE.MeshStandardMaterial({ color: threeColor(colors.hullHigh), metalness: 0.6, roughness: 0.45 })
    );
    wing.position.y = 2;
    const canard = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2, 30),
      new THREE.MeshStandardMaterial({ color: threeColor(colors.hullHigh), metalness: 0.6, roughness: 0.5 })
    );
    const eng = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pointGlow, color: threeColor(colors.glowEngine), transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    eng.position.set(0, 0, 30);
    eng.scale.set(20, 20, 1);
    const shield = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pointGlow, color: threeColor(colors.glowShield), transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    shield.scale.set(34, 34, 1);
    g.add(hull, wing, canard, eng, shield);
    return g;
  };

  const buildStation = (s: StationEntity): THREE.Group => {
    const g = new THREE.Group();
    const hub = new THREE.Mesh(
      new THREE.IcosahedronGeometry(70, 1),
      new THREE.MeshStandardMaterial({ color: threeColor(colors.stationHub), metalness: 0.6, roughness: 0.4, emissive: threeColor("#0a1a2a"), emissiveIntensity: 0.7 })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(170, 18, 14, 64),
      new THREE.MeshStandardMaterial({ color: threeColor(colors.stationRing), metalness: 0.65, roughness: 0.4 })
    );
    ring.rotation.x = 1.5;
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pointGlow, color: threeColor(colors.glowStation), transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    beacon.scale.set(140, 140, 1);
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

  let lastTick = 0;
  const renderRegion = (region: RegionState): void => {
    lastTick = region.tick;
    // Orbit planet deterministik dari tick (§2.3) — cinematic only, bukan otoritas.
    const t = region.tick * 0.001;
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      const th = t * [0.1, 0.05, 0.03][i];
      const yOff = [-200, 600, -400][i];
      p.position.set(orbitRadii[i] * Math.cos(th), yOff, orbitRadii[i] * 1.15 * Math.sin(th));
    }

    const live = new Set<string>();
    let firstVessel: VesselEntity | undefined;
    for (const e of region.entities.values()) {
      live.add(e.id);
      if (e.kind === "vessel") {
        const ve = e as VesselEntity;
        updateVessel(ve);
        if (!firstVessel) firstVessel = ve;
      } else if (e.kind === "station") {
        ensureEntry(e.id, () => buildStation(e as StationEntity), stations);
        const grp = stations.get(e.id)!;
        grp.position.set(e.position.x, e.position.y, e.position.z);
      }
    }
    for (const [id, grp] of vessels) if (!live.has(id)) { scene.remove(grp); disposeGroup(grp); vessels.delete(id); }
    for (const [id, grp] of stations) if (!live.has(id)) { scene.remove(grp); disposeGroup(grp); stations.delete(id); }

    // Follow-camera (§21): ease di belakang vessel utama — rasa "pilot".
    // Kalau tak ada vessel, biarkan kamera free di posisi awal.
    if (firstVessel) {
      const p = firstVessel.position;
      const yaw = firstVessel.heading.yaw;
      const offset = 950;
      const camTargetX = p.x - Math.sin(yaw) * offset;
      const camTargetZ = p.z - Math.cos(yaw) * offset;
      const camTargetY = p.y + 420;
      camera.position.x += (camTargetX - camera.position.x) * 0.06;
      camera.position.y += (camTargetY - camera.position.y) * 0.04;
      camera.position.z += (camTargetZ - camera.position.z) * 0.06;
      camera.lookAt(p.x, p.y + 60, p.z);
    }

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
    for (const m of vessels.values()) disposeGroup(m);
    for (const m of stations.values()) disposeGroup(m);
    vessels.clear(); stations.clear();
    disposeIfaces({ scene, starGeom, starMat, hotGeom, hotMats, beltGeom, beltMat, sunGeom, sunMat });
    if (target && renderer.domElement.parentElement === target) target.removeChild(renderer.domElement);
  };

  renderer.render(scene, camera);
  return { renderRegion, updateVessel, dispose };
}

// ---------------------------------------------------------------------------
// ARK-LIBRARIESCHIP — struktur vessel-world (blueprint §15/§18.5).
// Konstruksi murni procedural dengan material PBR dari tokens; no external asset.
// ---------------------------------------------------------------------------
function buildArkLibrary(): { group: THREE.Group } {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: threeColor(colors.struct), metalness: 0.7, roughness: 0.4, emissive: threeColor("#0a1424"), emissiveIntensity: 0.35 });
  const steelHigh = new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), metalness: 0.75, roughness: 0.3 });
  const amber = new THREE.MeshStandardMaterial({ color: threeColor(colors.tactical), emissive: threeColor(colors.tactical), emissiveIntensity: 1.4 });
  const tech = new THREE.MeshStandardMaterial({ color: threeColor(colors.tech), emissive: threeColor(colors.tech), emissiveIntensity: 1.2 });

  // Main keel — long-nacelle (bow → stern)
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(320, 380, 4200, 48), steel);
  keel.rotation.z = Math.PI / 2;
  g.add(keel);

  // Bow prow — tapered pylon
  const prow = new THREE.Mesh(new THREE.ConeGeometry(200, 1100, 40), steelHigh);
  prow.rotation.z = -Math.PI / 2;
  prow.position.x = 2400;
  g.add(prow);

  // Stern bulb — reactor/thrust housing
  const stern = new THREE.Mesh(new THREE.SphereGeometry(360, 40, 40), steel);
  stern.position.x = -2300;
  g.add(stern);

  // Central spire — the Library heart (sentral slot / katedral-bibliotek)
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(90, 220, 1100, 36), steelHigh);
  spire.position.y = 700;
  g.add(spire);
  const spireCap = new THREE.Mesh(new THREE.ConeGeometry(120, 260, 36), amber);
  spireCap.position.y = 1380;
  g.add(spireCap);

  // Jumlah ring-distrik: 4 katedral rings (menampung distrik/history)
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(640 + i * 40, 26, 16, 72), i === 1 ? amber : steelHigh);
    ring.rotation.x = 1.2 + i * 0.08;
    ring.position.x = -400 + i * 500;
    g.add(ring);
    // ring glow (distrik aktif — history)
    const ringGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: threeColor(i === 2 ? colors.glowStation : colors.glowEngine),
      transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    ringGlow.position.x = ring.position.x;
    ringGlow.scale.set(300, 300, 1);
    g.add(ringGlow);
  }

  // Basilica struts — cross spars (distrik menempel ke keel)
  for (let i = 0; i < 6; i++) {
    const spar = new THREE.Mesh(new THREE.BoxGeometry(140, 30, 1200), steelHigh);
    spar.position.x = -1000 + i * 400;
    spar.rotation.y = Math.PI / 2;
    g.add(spar);
  }

  // Landing/observation balconies — fraksi docking beacons (timur/west)
  const balL = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 40, 24), tech);
  balL.position.set(-700, 0, 760);
  g.add(balL);
  const balR = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 40, 24), tech);
  balR.position.set(-700, 0, -760);
  g.add(balR);

  // Dorsal coms pylons
  for (const x of [-1200, 0, 1200]) {
    const pylon = new THREE.Mesh(new THREE.ConeGeometry(40, 260, 8), steelHigh);
    pylon.position.set(x, 360, 0);
    g.add(pylon);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(30, 12, 12), amber);
    tip.position.set(x, 490, 0);
    g.add(tip);
  }

  return { group: g };
}

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

function disposeGroup(g: THREE.Group): void {
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

function disposeIfaces(o: Record<string, unknown>): void {
  for (const k of Object.keys(o)) {
    const v = (o as Record<string, unknown>)[k];
    if (v instanceof THREE.BufferGeometry) (v as THREE.BufferGeometry).dispose();
    else if (v instanceof THREE.Material) (v as THREE.Material).dispose();
    else if (v instanceof THREE.Scene) {
      v.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
          else (m.material as THREE.Material).dispose();
        }
      });
    }
  }
}