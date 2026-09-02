// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/scene3d.ts — LIVING COSMIC SYSTEM (blueprint 01 §2, D-008:
// visual ≠ otoritas posisi). Render cinematic, orbit deterministik.
//
// §2.1  Sistem bintang per region (star + planets + moons + belt + events)
// §2.2  Tiga lapis: COLLIDABLE / ATMOSPHERIC / BACKDROP
// §2.3  Orbit Kepler deterministik per tick; fase bulan dari geometri
// §2.4  Cosmic events: meteor shower · star flare · aurora (bergerak)
// §2.5  Dua skala koordinat: SYSTEM (benda langit) vs LOCAL (vessel)
// §2.6  Termal ∝ 1/r² — emissive planet naik saat dekat matahari
// §21   Camera modes: free · follow · tactical · cinematic
// §22   LOD — FAR/MID/NEAR adaptif (detail naik saat dekat)
//
// Post-processing: EffectComposer + UnrealBloomPass + OutputPass (core THREE,
// no CDN — CSP default-src 'self'). Semua texture dari Canvas (no asset).

import type { RegionState, VesselEntity, StationEntity } from "../../../../packages/gameserver/types";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { colors, threeColor, nebulaSeed } from "../ui/tokens";
import { effPixelRatio, type GameSettings } from "./settings";

export type CameraMode = "free" | "follow" | "tactical" | "cinematic";

export interface Scene3D {
  renderRegion(region: RegionState): void;
  updateVessel(v: VesselEntity): void;
  setCameraMode(mode: CameraMode): void;
  applyQuality(settings: GameSettings): void;
  setLookYawPitch(yaw: number, pitch: number): void;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Deterministic RNG & orbit math (client-side — sama deterministik server §2.3)
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface OrbitSpec {
  /** semi-major axis (render units). */
  semimajor: number;
  /** eccentricity 0..<1. */
  eccentricity: number;
  /** rotation per tick (rad). */
  omega: number;
  /** phase offset (rad). */
  phase: number;
  inclination: number;
}

function keplerPosition(o: OrbitSpec, tick: number): THREE.Vector3 {
  const M = o.phase + tick * o.omega;
  const e = o.eccentricity;
  // Iterasi 3× buat Mean→Eccentric anomaly (cukup buat e<0.4; deterministik).
  let E = M;
  for (let i = 0; i < 3; i++) E = M + e * Math.sin(E);
  const x = o.semimajor * (Math.cos(E) - e);
  const z = o.semimajor * Math.sqrt(1 - e * e) * Math.sin(E);
  // Rossi ke bidang miring (inclination).
  const ci = Math.cos(o.inclination);
  const y = z * Math.sin(o.inclination);
  return new THREE.Vector3(x, y, z * ci);
}

// ---------------------------------------------------------------------------
// Body catalogue (blueprint §2.1/§2.2) — tipe berbeda, bukan bolak warna.
// ---------------------------------------------------------------------------
type PlanetKind = "gasGiant" | "gasGiantRinged" | "ice" | "ocean" | "desert" | "volcanic";

interface PlanetSpec {
  kind: PlanetKind;
  baseColor: string;
  emissive: string;
  roughness: number;
  metalness: number;
  /** yang menyusun ring (Torus) — hanya gas giant ringed. */
  hasRing?: boolean;
  moons: number;
}

const PLANET_CATALOG: PlanetSpec[] = [
  { kind: "gasGiant", baseColor: colors.planetGasGiant, emissive: "#000000", roughness: 0.9, metalness: 0.0, moons: 2 },
  { kind: "gasGiantRinged", baseColor: colors.planetGasGiant, emissive: "#5a3a1a", roughness: 0.85, metalness: 0.1, hasRing: true, moons: 3 },
  { kind: "ice", baseColor: colors.planetIce, emissive: "#000000", roughness: 0.3, metalness: 0.5, moons: 1 },
  { kind: "ocean", baseColor: colors.planetOcean, emissive: "#000000", roughness: 0.2, metalness: 0.4, moons: 1 },
  { kind: "desert", baseColor: colors.planetDesert, emissive: "#000000", roughness: 0.95, metalness: 0.05, moons: 0 },
  { kind: "volcanic", baseColor: colors.planetLava, emissive: colors.lavaGlow, roughness: 0.8, metalness: 0.3, moons: 0 },
];

export function initScene3D(container?: HTMLElement, settings?: GameSettings): Scene3D {
  const target = container ?? (typeof document !== "undefined" ? document.getElementById("app") : null);
  const width = target?.clientWidth ?? 800;
  const height = target?.clientHeight ?? 600;
  const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(threeColor(colors.voidDeep));

  // =================== CAMERA (perspektif pilot, §21 camera modes) ==========
  const camera = new THREE.PerspectiveCamera(70, width / height, 1, 1_000_000);
  camera.position.set(0, 1600, 6400);
  camera.lookAt(0, 0, 0);
  let camMode: CameraMode = "follow";

  // =================== RENDERER + POST (glow real, bukan sprite) ============
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  if (target) target.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.15, 0.45, 0.65);
  composer.addPass(bloomPass);
  const outputPass = new OutputPass(); // menangani tone mapping di akhir
  composer.addPass(outputPass);

  // =================== ENV MAP (Fase 1 — PMREMGenerator) ====================
  // Kapal memantulkan cahaya suns/planets/nebula via PBR envMap.
  // Regen tiap 10 frame (PMREM mahal, jangan tiap frame). scene.environment
  // auto-apply ke semua MeshStandardMaterial tanpa set envMap manual.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let pmremTarget: THREE.WebGLRenderTarget | null = null;
  let envFrame = 0;

  const rand = mulberry32(nebulaSeed);

  // =================== STARFIELD (FAR §22, instanced) =======================
  const starDummy = new THREE.Object3D();
  const starGeom = new THREE.SphereGeometry(1, 4, 4);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const makeStars = (count: number): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(starGeom, starMat, count);
    for (let i = 0; i < count; i++) {
      const r = 20000 + rand() * 120000;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      starDummy.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      starDummy.scale.set(1 + rand() * 3, 1 + rand() * 3, 1 + rand() * 3);
      starDummy.updateMatrix();
      mesh.setMatrixAt(i, starDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  };
  makeStars(6000);

  // Bintang panas spectral (depth)
  const hotGeom = new THREE.SphereGeometry(1, 6, 6);
  const hotColorList = [colors.hotStarA, colors.hotStarB, colors.hotStarC];
  const hotMesh = new THREE.InstancedMesh(hotGeom, new THREE.MeshBasicMaterial({ color: 0xffffff }), 160);
  for (let i = 0; i < 160; i++) {
    const r = 30000 + rand() * 150000;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    starDummy.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    starDummy.scale.set(3 + rand() * 10, 3 + rand() * 10, 3 + rand() * 10);
    hotMesh.setColorAt(i, new THREE.Color(threeColor(hotColorList[i % 3])));
    starDummy.updateMatrix();
    hotMesh.setMatrixAt(i, starDummy.matrix);
  }
  hotMesh.instanceMatrix.needsUpdate = true;
  if (hotMesh.instanceColor) hotMesh.instanceColor.needsUpdate = true;
  scene.add(hotMesh);

  // =================== NEBULA — dua lapis atmosferik (§2.2 ATMOSPHERIC) =====
  const nebulaTex = makeGlowTexture();
  const nebulaSprites: THREE.Sprite[] = [];
  const buildNebula = (count: number): void => {
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
  };
  buildNebula(9);

  // =================== SUN(S) — binary/trinary §2.1, termal §2.6 ============
  let starBodies = 1;
  const suns: {
    sun: THREE.Mesh;
    glow: THREE.Sprite;
    light: THREE.DirectionalLight;
    orbit: OrbitSpec;
  }[] = [];
  const sunGeom = new THREE.SphereGeometry(900, 64, 64);
  const coronaTex = makeGlowTexture();

  const buildSuns = (n: number): void => {
    for (const s of suns) {
      scene.remove(s.sun); scene.remove(s.glow); scene.remove(s.light);
      (s.sun.material as THREE.Material).dispose();
      (s.glow.material as THREE.SpriteMaterial).map?.dispose();
    }
    suns.length = 0;
    const massRatio = n === 3 ? [0.9, 0.5, 0.7] : n === 2 ? [1.0, 0.55] : [1.0];
    for (let i = 0; i < n; i++) {
      const sunMat = new THREE.MeshStandardMaterial({
        color: threeColor(colors.sun),
        emissive: threeColor(colors.sunEmissive),
        emissiveIntensity: 2.4 * massRatio[i],
      });
      const sun = new THREE.Mesh(sunGeom, sunMat);
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
  };
  buildSuns(1);

  const ambient = new THREE.AmbientLight(threeColor(colors.struct), 0.5);
  scene.add(ambient);

  // =================== PLANETS + MOONS + RINGS (§2.1/§2.3) ==================
  interface Planet3D {
    mesh: THREE.Mesh;
    atmo: THREE.Sprite;
    atmoMat: THREE.SpriteMaterial;
    emissiveBase: number;
    orbit: OrbitSpec;
    radius: number;
    spec: PlanetSpec;
    ring?: THREE.Mesh;
    moons: { mesh: THREE.Mesh; orbit: OrbitSpec }[];
    baseColor: THREE.Color;
  }
  const planets: Planet3D[] = [];
  const planetCache: { geom: THREE.SphereGeometry; mat: THREE.MeshStandardMaterial }[] = [];

  let planetCount = 9;

  const buildPlanetSystem = (count: number, detail: number): void => {
    for (const p of planets) {
      scene.remove(p.mesh); scene.remove(p.atmo); if (p.ring) scene.remove(p.ring);
      for (const m of p.moons) scene.remove(m.mesh);
      (p.mesh.material as THREE.Material).dispose();
      if (p.ring) (p.ring.material as THREE.Material).dispose();
      for (const m of p.moons) (m.mesh.material as THREE.Material).dispose();
    }
    planets.length = 0;
    planetCache.length = 0;

    const radii = [1800, 1450, 1100, 900, 780, 640, 520, 420, 320];
    for (let i = 0; i < count; i++) {
      const spec = PLANET_CATALOG[i % PLANET_CATALOG.length];
      const radius = radii[Math.min(i, radii.length - 1) - (i >= count ? count - 1 : 0)];
      const seg = Math.max(16, detail);
      const geom = new THREE.SphereGeometry(radius, seg, seg);
      const mat = new THREE.MeshStandardMaterial({
        color: threeColor(spec.baseColor),
        emissive: threeColor(spec.emissive),
        emissiveIntensity: spec.kind === "volcanic" ? 1.1 : 0.15,
        roughness: spec.roughness,
        metalness: spec.metalness,
      });
      planetCache.push({ geom, mat });
      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);

      // Atmosfer (ATMOSPHERIC §2.2) — rim glow
      const atmoMat = new THREE.SpriteMaterial({
        map: coronaTex, color: threeColor(spec.baseColor), transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const atmo = new THREE.Sprite(atmoMat);
      atmo.scale.set(radius * 3.6, radius * 3.6, 1);
      mesh.add(atmo);

      // Ring (hanya gas giant ringed)
      let ring: THREE.Mesh | undefined;
      if (spec.hasRing) {
        const ringMat = new THREE.MeshStandardMaterial({
          color: threeColor("#8a7a6a"), emissive: threeColor("#2a1a0a"), emissiveIntensity: 0.35,
          side: THREE.DoubleSide, roughness: 0.9, transparent: true, opacity: 0.85,
        });
        const ringGeom = new THREE.RingGeometry(radius * 1.6, radius * 2.6, 96);
        ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = -Math.PI / 2 + 0.12;
        mesh.add(ring);
      }

      // Moons (§2.3) — mengorbit planet, fase lunar dari geometri
      const moons: Planet3D["moons"] = [];
      for (let m = 0; m < spec.moons; m++) {
        const moonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 0.18, 16, 16),
          new THREE.MeshStandardMaterial({ color: threeColor(colors.struct), roughness: 1, metalness: 0.1 })
        );
        scene.add(moonMesh);
        moons.push({
          mesh: moonMesh,
          orbit: { semimajor: radius * (2.4 + m * 0.9), eccentricity: 0.03, omega: 0.09 + m * 0.04, phase: m * 1.7, inclination: 0.4 },
        });
      }

      planets.push({
        mesh,
        atmo,
        atmoMat,
        emissiveBase: mat.emissiveIntensity,
        orbit: {
          semimajor: 9000 + i * 5200,
          eccentricity: [0.08, 0.16, 0.05, 0.2, 0.1, 0.06, 0.12, 0.09, 0.04][i % 9],
          omega: [0.12, 0.08, 0.06, 0.045, 0.035, 0.026, 0.02, 0.014, 0.011][i % 9],
          phase: i * 0.9,
          inclination: (i % 3) * 0.06 - 0.06,
        },
        radius,
        spec,
        ring,
        moons,
        baseColor: new THREE.Color(threeColor(spec.baseColor)),
      });
    }
  };
  buildPlanetSystem(planetCount, 48);

  // =================== ASTEROID BELT (COLLIDABLE visual §2.1/§2.2) ==========
  const beltDummy = new THREE.Object3D();
  const beltGeom = new THREE.DodecahedronGeometry(14, 0);
  const beltMat = new THREE.MeshStandardMaterial({ color: threeColor(colors.belt), roughness: 1, metalness: 0.12 });
  let beltCount = 6000;
  let belt: THREE.InstancedMesh | null = null;
  const buildBelt = (count: number): void => {
    if (belt) { scene.remove(belt); (belt.material as THREE.Material).dispose(); }
    belt = new THREE.InstancedMesh(beltGeom, beltMat, count);
    for (let i = 0; i < count; i++) {
      const r = 26000 + rand() * 8000;
      const angle = rand() * Math.PI * 2;
      beltDummy.position.set(r * Math.cos(angle), (rand() - 0.5) * 1600, r * Math.sin(angle));
      const s = 4 + rand() * 20;
      beltDummy.scale.set(s, s, s);
      beltDummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      beltDummy.updateMatrix();
      belt.setMatrixAt(i, beltDummy.matrix);
    }
    belt.instanceMatrix.needsUpdate = true;
    belt.rotation.x = 1.1;
    scene.add(belt);
  };
  buildBelt(beltCount);

  // =================== BACKDROP PLANETS (§2.2) — sense of scale =============
  const backdrops: { mesh: THREE.Mesh; orbit: OrbitSpec; drift: number }[] = [];
  const buildBackdrops = (): void => {
    for (const b of backdrops) { scene.remove(b.mesh); (b.mesh.material as THREE.Material).dispose(); }
    backdrops.length = 0;
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: threeColor(colors.backdropPlanet), transparent: true, opacity: 0.35,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(18000 + rand() * 22000, 24, 24), mat);
      mesh.position.set(
        (rand() - 0.5) * 400000,
        (rand() - 0.5) * 120000,
        -180000 - rand() * 300000
      );
      scene.add(mesh);
      backdrops.push({ mesh, orbit: { semimajor: 380000 * (1 + i * 0.15), eccentricity: 0.02, omega: 0.0018 + i * 0.0003, phase: i * 1.3, inclination: 0.05 }, drift: 0 });
    }
  };
  buildBackdrops();

  // =================== COSMIC EVENTS (§2.4) — meteor / flare / aurora =======
  const meteors: { line: THREE.Line; start: THREE.Vector3; v: THREE.Vector3; life: number; ttl: number }[] = [];
  const meteorMat = new THREE.LineBasicMaterial({ color: threeColor(colors.meteorTrail), transparent: true, opacity: 0.9 });
  const auroraMat = new THREE.SpriteMaterial({
    map: nebulaTex, color: threeColor(colors.auroraA), transparent: true, opacity: 0.14,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const auroraSpr = new THREE.Sprite(auroraMat);
  auroraSpr.scale.set(90000, 26000, 1);
  auroraSpr.position.set(-20000, 22000, -40000);
  scene.add(auroraSpr);
  const auroraMatB = new THREE.SpriteMaterial({
    map: nebulaTex, color: threeColor(colors.auroraB), transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const auroraSprB = new THREE.Sprite(auroraMatB);
  auroraSprB.scale.set(70000, 20000, 1);
  auroraSprB.position.set(22000, 24000, -46000);
  scene.add(auroraSprB);

  const spawnMeteor = (): void => {
    if (meteors.length > 60) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(g, meteorMat);
    const start = new THREE.Vector3(
      (rand() - 0.5) * 80000, 8000 + rand() * 20000, -(rand() + 1) * 60000
    );
    const v = new THREE.Vector3(1200 + rand() * 2000, -(200 + rand() * 600), 2600 + rand() * 3000);
    scene.add(line);
    meteors.push({ line, start, v, life: 0, ttl: 1.2 + rand() * 1.8 });
    updateMeteorPos(line, start, v, 0);
  };
  const updateMeteorPos = (line: THREE.Line, start: THREE.Vector3, v: THREE.Vector3, t: number): void => {
    const attr = line.geometry.attributes.position as THREE.BufferAttribute;
    attr.setXYZ(0, start.x + v.x * t, start.y + v.y * t, start.z + v.z * t);
    attr.setXYZ(1, start.x + v.x * (t + 0.16), start.y + v.y * (t + 0.16), start.z + v.z * (t + 0.16));
    attr.needsUpdate = true;
  };

  // =================== ARK-LIBRARIESCHIP (§18.5) — tetap ada =================
  const ark = buildArkLibrary();
  ark.group.position.set(-32000, -2000, 3000);
  scene.add(ark.group);

  // =================== ENTITIES (LOCAL scale §2.5) ===========================
  const vessels = new Map<string, THREE.Group>();
  const stations = new Map<string, THREE.Group>();
  // Interpolasi antar snapshot (D-008 presentation only)
  const prev = new Map<string, THREE.Vector3>();
  const cur = new Map<string, THREE.Vector3>();
  let anchor = new THREE.Vector3(0, 0, 0);
  const LOCAL_SCALE = 1 / 90000; // local meters → render units (§2.5)
  const clampLocal = (v: THREE.Vector3, a: THREE.Vector3): THREE.Vector3 =>
    v.clone().sub(a).multiplyScalar(LOCAL_SCALE).clampLength(0, 6000);

  const buildVessel = (v: VesselEntity): THREE.Group => {
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
  };

  const buildStation = (s: StationEntity): THREE.Group => {
    const g = new THREE.Group();
    const hub = new THREE.Mesh(
      new THREE.IcosahedronGeometry(80, 1),
      new THREE.MeshStandardMaterial({ color: threeColor(colors.stationHub), metalness: 0.6, roughness: 0.4, emissive: threeColor("#0a1a2a"), emissiveIntensity: 0.7 })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(190, 20, 14, 64),
      new THREE.MeshStandardMaterial({ color: threeColor(colors.stationRing), metalness: 0.65, roughness: 0.4 })
    );
    ring.rotation.x = 1.5;
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: threeColor(colors.glowStation), transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    beacon.scale.set(160, 160, 1);
    g.add(hub, ring, beacon);
    return g;
  };

  const ensureEntry = (id: string, build: () => THREE.Group, map: Map<string, THREE.Group>): THREE.Group => {
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
    const p = clampLocal(new THREE.Vector3(v.position.x, v.position.y, v.position.z), anchor);
    cur.set(v.id, p);
    if (!prev.has(v.id)) prev.set(v.id, p.clone());
    grp.rotation.set(v.heading.pitch, v.heading.yaw, 0);
  };

  let lastTick = 0;
  let firstVesselRef: VesselEntity | undefined;
  let lastSnapshotAt = performance.now();

  const renderRegion = (region: RegionState): void => {
    lastTick = region.tick;
    lastSnapshotAt = performance.now();
    // Rotasi prev←cur: nilai lama jadi starting point interpolasi.
    prev.clear();
    for (const [id, p] of cur) prev.set(id, p.clone());
    cur.clear();

    firstVesselRef = undefined;
    for (const e of region.entities.values()) {
      if (e.kind === "vessel") {
        const ve = e as VesselEntity;
        if (!firstVesselRef) { firstVesselRef = ve; anchor.set(ve.position.x, ve.position.y, ve.position.z); }
      }
    }
    // Pass kedua — anchor final.
    for (const e of region.entities.values()) {
      if (e.kind === "vessel") updateVessel(e as VesselEntity);
      else {
        const se = e as StationEntity;
        const grp = ensureEntry(se.id, () => buildStation(se), stations);
        const p = clampLocal(new THREE.Vector3(se.position.x, se.position.y, se.position.z), anchor);
        grp.position.copy(p);
      }
    }
    // Bersihkan entity yang mati.
    const live = new Set<string>();
    for (const e of region.entities.values()) live.add(e.id);
    for (const [id, grp] of vessels) if (!live.has(id)) { scene.remove(grp); disposeGroup(grp); vessels.delete(id); prev.delete(id); cur.delete(id); }
    for (const [id, grp] of stations) if (!live.has(id)) { scene.remove(grp); disposeGroup(grp); stations.delete(id); }
  };

  // =================== CAMERA MODES (§21) ====================================
  let lookYaw = 0, lookPitch = 0;
  const setLookYawPitch = (yaw: number, pitch: number): void => {
    lookYaw = yaw; lookPitch = Math.max(-1.2, Math.min(1.2, pitch));
  };
  const setCameraMode = (mode: CameraMode): void => { camMode = mode; };

  const updateCamera = (t: number): void => {
    const target = firstVesselRef;
    const p = new THREE.Vector3(0, 0, 0);
    if (target) p.copy(clampLocal(new THREE.Vector3(target.position.x, target.position.y, target.position.z), anchor));
    let d = 0.06;
    if (camMode === "cinematic") {
      // §21 cinematic — sweeping, dramatic angle, membidik system.
      const r = 4200 + Math.sin(t * 0.00002) * 1400;
      camera.position.x = Math.sin(t * 0.00012) * r;
      camera.position.z = Math.cos(t * 0.00012) * r;
      camera.position.y = 2400 + Math.sin(t * 0.00006) * 600;
      camera.lookAt(0, 0, 0);
      return;
    }
    if (camMode === "tactical") {
      // §21 tactical — overview battlefield dari atas.
      const r = 1600;
      camera.position.x = p.x + Math.sin(t * 0.00004) * r;
      camera.position.z = p.z + Math.cos(t * 0.00004) * r;
      camera.position.y = p.y + 2600;
      camera.lookAt(p.x, p.y, p.z);
      return;
    }
    // follow & free: pilot perspective
    if (camMode === "follow" && target) {
      const yaw = target.heading.yaw + lookYaw;
      const pitch = lookPitch;
      const offset = 1300;
      const cosP = Math.cos(pitch);
      const cx = p.x - Math.sin(yaw) * offset * cosP;
      const cz = p.z - Math.cos(yaw) * offset * cosP;
      const cy = p.y + Math.sin(pitch) * offset + 420;
      camera.position.x += (cx - camera.position.x) * d;
      camera.position.y += (cy - camera.position.y) * d * 0.7;
      camera.position.z += (cz - camera.position.z) * d;
      camera.lookAt(p.x, p.y + 80, p.z);
    } else {
      // free
      const yaw = lookYaw, pitch = lookPitch;
      const radius = 5200;
      camera.position.x = p.x + radius * Math.sin(yaw) * Math.cos(pitch);
      camera.position.y = p.y + radius * Math.sin(pitch);
      camera.position.z = p.z + radius * Math.cos(yaw) * Math.cos(pitch);
      camera.lookAt(p.x, p.y, p.z);
    }
  };

  // =================== QUALITY (settings → scene live) =======================
  let settingsRef: GameSettings;
  const applyQuality = (s: GameSettings): void => {
    settingsRef = s;
    renderer.setPixelRatio(effPixelRatio(s, DPR));
    renderer.setSize(width, height);
    composer.setSize(width, height);
    bloomPass.resolution.set(width * s.resolutionScale, height * s.resolutionScale);
    const bloomEnabled = s.bloom !== "off";
    bloomPass.enabled = bloomEnabled;
    bloomPass.strength = s.bloom === "high" ? 1.2 : 0.65;
    if (s.toneMapping === "AGX") renderer.toneMapping = THREE.AgXToneMapping;
    else if (s.toneMapping === "REINHARD") renderer.toneMapping = THREE.ReinhardToneMapping;
    else renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Density & detail rebuild
    if (s.nebulaDensity !== nebulaSprites.length) buildNebula(Math.min(12, s.nebulaDensity));
    if (s.starBodies !== starBodies) { starBodies = s.starBodies; buildSuns(Math.max(1, Math.min(3, starBodies))); }
    if (s.planetCount !== planetCount) { planetCount = s.planetCount; buildPlanetSystem(planetCount, s.planetDetail); }
    if (s.beltDensity !== beltCount) { beltCount = s.beltDensity; buildBelt(beltCount); }
  };

  // =================== RENDER LOOP (rAF, sim terpisah → §22/§24) =============
  let running = false;
  let rafId = 0;
  let lastFrame = 0;

  // §2.3 Orbit deterministik per tick — smooth di sub-tick via TIME_BASE.
  const simTick = (): number => lastTick + (performance.now() - lastSnapshotAt) / 100;

  const frame = (now: number): void => {
    rafId = requestAnimationFrame(frame);
    const t = now; // ms — dipakai kamera cinematic
    const cap = settingsRef.fpsCap;
    if (cap) {
      const elapsed = now - lastFrame;
      if (elapsed < 1000 / cap) { updateCamera(t); return; } // throttle ke cap (camera tetap hidup)
    }
    lastFrame = now;

    // Fase 1 — env map regen tiap 10 frame (presentasi, bukan otoritas).
    if (++envFrame % 10 === 0) {
      if (pmremTarget) pmremTarget.dispose();
      pmremTarget = pmrem.fromScene(scene, 0.04);
      scene.environment = pmremTarget.texture;
    }

    // §2.3/§2.5: sistem bintang & planet—deterministik, mengorbit barycenter.
    const tick = simTick();
    for (let i = 1; i < suns.length; i++) {
      const p = keplerPosition(suns[i].orbit, tick);
      suns[i].sun.position.copy(p);
      suns[i].glow.position.copy(p);
      suns[i].light.position.copy(p);
    }
    for (const pl of planets) {
      const p = keplerPosition(pl.orbit, tick);
      pl.mesh.position.copy(p);
      pl.atmo.position.copy(p);
      if (pl.ring) pl.ring.position.copy(p);
      for (const mo of pl.moons) {
        const mp = keplerPosition(mo.orbit, tick);
        mo.mesh.position.set(p.x + mp.x, p.y + mp.y, p.z + mp.z);
        // §2.3 fase lunar dari geometri (arah relatif ke matahari)
        const mdir = mo.mesh.position.clone().sub(p).normalize();
        const sdir = suns[0].sun.position.clone().sub(p).normalize();
        (mo.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + 0.6 * Math.max(0, mdir.dot(sdir));
      }
    }

    // §2.6 Termal: emissive planet ∝ 1/(1+r²) relatif matahari.
    for (const pl of planets) {
      const d = pl.mesh.position.distanceTo(suns[0].sun.position);
      const r = Math.max(1, d / 5000);
      const thermal = Math.min(1.5, pl.emissiveBase + 1.2 / (r * r));
      (pl.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = thermal;
    }
    // Meteor shower (§2.4) — spawning bursty & bergerak (peak saat "hujan").
    const burst = Math.sin(t * 0.0007) > 0.985 || Math.cos(t * 0.0009) > 0.995 ? 4 : 1;
    for (let i = 0; i < burst; i++) spawnMeteor();
    for (const m of meteors.slice()) {
      m.life += 1 / 60;
      m.ttl -= 1 / 60;
      updateMeteorPos(m.line, m.start, m.v, m.life);
      if (m.ttl <= 0) {
        scene.remove(m.line);
        m.line.geometry.dispose();
        meteors.splice(meteors.indexOf(m), 1);
      }
    }
    // Aurora — denyut halus (§2.4)
    auroraSpr.material.opacity = 0.1 + 0.06 * Math.sin(t * 0.0002);
    auroraSprB.material.opacity = 0.07 + 0.05 * Math.cos(t * 0.00025);

    // Interpolasi vessel (presentation ✓, autoritas server tetap D-008).
    const alpha = Math.min(1, (now - lastSnapshotAt) / 100);
    for (const [id, grp] of vessels) {
      const a = prev.get(id); const b = cur.get(id);
      if (a && b) grp.position.lerpVectors(a, b, alpha);
    }

    updateCamera(t);
    composer.render();
  };

  // Snapshot timing (biar interp akurat)
  renderer.setPixelRatio(Math.min(DPR, 2));
  const stopLoop = (): void => cancelAnimationFrame(rafId);

  const onResize = (): void => {
    const w = target?.clientWidth ?? width;
    const h = target?.clientHeight ?? height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  };
  if (typeof window !== "undefined") window.addEventListener("resize", onResize);

  const dispose = (): void => {
    if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
    stopLoop();
    running = false;
    if (pmremTarget) { pmremTarget.dispose(); pmremTarget = null; }
    pmrem.dispose();
    scene.environment = null;
    renderer.dispose();
    composer.dispose();
    for (const m of vessels.values()) disposeGroup(m);
    for (const m of stations.values()) disposeGroup(m);
    vessels.clear(); stations.clear();
    for (const pl of planets) {
      scene.remove(pl.mesh); scene.remove(pl.atmo); if (pl.ring) scene.remove(pl.ring);
      for (const mo of pl.moons) scene.remove(mo.mesh);
    }
    for (const b of backdrops) scene.remove(b.mesh);
    for (const m of meteors) scene.remove(m.line);
    if (target && renderer.domElement.parentElement === target) target.removeChild(renderer.domElement);
  };

  // Start rAF
  running = true;
  if (settings) applyQuality(settings);
  else settingsRef = { preset: "ULTRA", fpsCap: 0, resolutionScale: 1, pixelRatio: 2, antialias: true, bloom: "high", shadowQuality: "high", nebulaDensity: 12, starBodies: 3, planetCount: 9, planetDetail: 48, beltDensity: 8000, vesselDetail: 3, toneMapping: "ACES" } as GameSettings;
  lastFrame = performance.now();
  lastSnapshotAt = lastFrame;
  rafId = requestAnimationFrame(frame);

  return { renderRegion, updateVessel, setCameraMode, applyQuality, setLookYawPitch, dispose };
}

// ---------------------------------------------------------------------------
// ARK-LIBRARIESCHIP (§18.5) — struktur vessel-world procedural.
// ---------------------------------------------------------------------------
function buildArkLibrary(): { group: THREE.Group } {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: threeColor(colors.struct), metalness: 0.7, roughness: 0.4, emissive: threeColor("#0a1424"), emissiveIntensity: 0.35 });
  const steelHigh = new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), metalness: 0.75, roughness: 0.3 });
  const amber = new THREE.MeshStandardMaterial({ color: threeColor(colors.tactical), emissive: threeColor(colors.tactical), emissiveIntensity: 1.4 });
  const tech = new THREE.MeshStandardMaterial({ color: threeColor(colors.tech), emissive: threeColor(colors.tech), emissiveIntensity: 1.2 });

  const keel = new THREE.Mesh(new THREE.CylinderGeometry(320, 380, 4200, 48), steel);
  keel.rotation.z = Math.PI / 2;
  g.add(keel);

  const prow = new THREE.Mesh(new THREE.ConeGeometry(200, 1100, 40), steelHigh);
  prow.rotation.z = -Math.PI / 2;
  prow.position.x = 2400;
  g.add(prow);

  const stern = new THREE.Mesh(new THREE.SphereGeometry(360, 40, 40), steel);
  stern.position.x = -2300;
  g.add(stern);

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(90, 220, 1100, 36), steelHigh);
  spire.position.y = 700;
  g.add(spire);
  const spireCap = new THREE.Mesh(new THREE.ConeGeometry(120, 260, 36), amber);
  spireCap.position.y = 1380;
  g.add(spireCap);

  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(640 + i * 40, 26, 16, 72), i === 1 ? amber : steelHigh);
    ring.rotation.x = 1.2 + i * 0.08;
    ring.position.x = -400 + i * 500;
    g.add(ring);
    const ringGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: threeColor(i === 2 ? colors.glowStation : colors.glowEngine),
      transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    ringGlow.position.x = ring.position.x;
    ringGlow.scale.set(300, 300, 1);
    g.add(ringGlow);
  }
  for (let i = 0; i < 6; i++) {
    const spar = new THREE.Mesh(new THREE.BoxGeometry(140, 30, 1200), steelHigh);
    spar.position.x = -1000 + i * 400;
    spar.rotation.y = Math.PI / 2;
    g.add(spar);
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
  const seenGeom = new Set<THREE.BufferGeometry>();
  const seenMat = new Set<THREE.Material>();
  const seenTex = new Set<THREE.Texture>();
  g.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
    const geom = mesh.geometry as THREE.BufferGeometry | undefined;
    if (geom && !seenGeom.has(geom)) { seenGeom.add(geom); geom.dispose(); }
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const mm of mats as THREE.Material[]) {
      if (!mm || seenMat.has(mm)) continue;
      seenMat.add(mm);
      const withMap = mm as unknown as { map?: THREE.Texture | null };
      if (withMap.map && !seenTex.has(withMap.map)) { seenTex.add(withMap.map); withMap.map.dispose(); }
      mm.dispose();
    }
    const sprite = o as unknown as { material?: THREE.SpriteMaterial };
    if (sprite.material && (sprite.material as unknown as { map?: THREE.Texture }).map) {
      const tex = (sprite.material as unknown as { map: THREE.Texture }).map;
      if (tex && !seenTex.has(tex)) { seenTex.add(tex); tex.dispose(); }
    }
  });
}