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

  // =================== ARK-LIBRARIESCHIP (§18.5) — stadium megastructure AAA+ =====
  const arkBuild = buildArkLibrary();
  const ark = arkBuild.group;
  ark.position.set(-32000, -2000, 3000);
  scene.add(ark);
  // Ark animation refs — dipakai di frame() (ring rotation, engine pulse, shield pulse, antenna sway)
  const arkRings = arkBuild.rings;
  const arkRingGroups = arkBuild.ringGroups;
  const arkEngines = arkBuild.engines;
  const arkShields = arkBuild.shields;
  const arkAntennas = arkBuild.antennas;

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

  // =================== EXPLOSIONS (Fase 4 — full particle) ====================
  interface Explosion {
    burst: THREE.Sprite[];
    debris: THREE.Mesh[];
    debrisVel: THREE.Vector3[];
    sparks: THREE.Line[];
    sparkVel: THREE.Vector3[];
    flash: THREE.Sprite | null;
    pos: THREE.Vector3;
    t: number;
    ttlDebris: number;
  }
  const explosions: Explosion[] = [];
  const spawnExplosion = (pos: THREE.Vector3): void => {
    const p = pos.clone();
    // 5 burst sprites — orange→red→dark, scale 20→200→0 over 0.8s
    const burstColors = ["#ff6a00", "#ff3a00", "#ff1a00", "#8a1a05", "#2a0a03"];
    const burst: THREE.Sprite[] = [];
    for (let i = 0; i < 5; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(), color: new THREE.Color(burstColors[i]), transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      spr.position.copy(p);
      spr.position.x += (Math.random() - 0.5) * 8;
      spr.position.y += (Math.random() - 0.5) * 8;
      spr.position.z += (Math.random() - 0.5) * 8;
      spr.scale.set(20 + i * 6, 20 + i * 6, 1);
      scene.add(spr);
      burst.push(spr);
    }
    // 12 debris fragments — Box 2..5, velocity outward, gravity
    const debris: THREE.Mesh[] = [];
    const debrisVel: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i++) {
      const s = 2 + Math.random() * 3;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s),
        new THREE.MeshStandardMaterial({ color: threeColor(i % 3 ? colors.hullHigh : colors.hull), metalness: 0.5, roughness: 0.5, transparent: true, opacity: 1 }));
      m.position.copy(p);
      m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(m);
      debris.push(m);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      debrisVel.push(dir.multiplyScalar(18 + Math.random() * 42));
    }
    // 30 sparks — Line 2 points, high velocity, fade 0.3s
    const sparks: THREE.Line[] = [];
    const sparkVel: THREE.Vector3[] = [];
    const sparkMatBase = new THREE.LineBasicMaterial({ color: threeColor("#ffd67a"), transparent: true, opacity: 1 });
    for (let i = 0; i < 30; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([p.x, p.y, p.z, p.x, p.y, p.z]), 3));
      const mat = sparkMatBase.clone();
      mat.color = new THREE.Color(`hsl(${28 + Math.random() * 18}, 100%, ${60 + Math.random() * 30}%)`);
      const line = new THREE.Line(g, mat);
      scene.add(line);
      sparks.push(line);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      sparkVel.push(dir.multiplyScalar(90 + Math.random() * 120));
    }
    // Shield flash — white additive 50→150→0 in 0.2s
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: new THREE.Color(0xffffff), transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flash.position.copy(p);
    flash.scale.set(50, 50, 1);
    scene.add(flash);
    explosions.push({ burst, debris, debrisVel, sparks, sparkVel, flash, pos: p, t: 0, ttlDebris: 2.0 });
  };

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
    // Bersihkan entity yang mati — Fase 4 trigger ledakan di posisi terakhir.
    const live = new Set<string>();
    for (const e of region.entities.values()) live.add(e.id);
    for (const [id, grp] of vessels) if (!live.has(id)) {
      const p = cur.get(id)?.clone() ?? grp.position.clone();
      spawnExplosion(p);
      scene.remove(grp); disposeGroup(grp); vessels.delete(id); prev.delete(id); cur.delete(id);
    }
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

    // Ark — stadium megastructure animation (Fase 3) — ring rotasi beda arah + engine/shield pulse + antenna sway
    // Rings: 1:+0.001, 2:-0.0015, 3:+0.002, 4:-0.0008 per frame (60fps ~ 0.06/0.09/0.12/0.048 rad/s)
    // Habitat/windows/ports/platforms jadi child dari ringGroups (rg) jadi ikut rotasi group
    if (arkRingGroups.length === 4) {
      arkRingGroups[0].rotation.y += 0.001;
      arkRingGroups[1].rotation.y -= 0.0015;
      arkRingGroups[2].rotation.y += 0.002;
      arkRingGroups[3].rotation.y -= 0.0008;
    }
    for (let i = 0; i < arkEngines.length; i++) {
      arkEngines[i].material.opacity = 0.62 + 0.32 * Math.sin(t * 0.003 + i * 1.1);
      arkEngines[i].material.needsUpdate = true;
    }
    for (let i = 0; i < arkShields.length; i++) {
      const pulse = 0.42 + 0.38 * Math.sin(t * 0.002 + i * 0.9);
      arkShields[i].sprite.material.opacity = pulse;
      (arkShields[i].mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55 + pulse * 0.9;
    }
    for (let i = 0; i < arkAntennas.length; i++) {
      arkAntennas[i].rotation.z = Math.sin(t * 0.0005 + i) * 0.022;
    }

    // Fase 4 — explosion full particle update (burst 0.8s, sparks 0.3s, flash 0.2s, debris 2s)
    {
      const dt = 1 / 60;
      for (let ei = explosions.length - 1; ei >= 0; ei--) {
        const ex = explosions[ei];
        ex.t += dt;
        const k = ex.t;
        // burst 5 sprites — scale 20→200, opacity 1→0 in 0.8s
        for (const s of ex.burst) {
          if (k <= 0.8) {
            const sc = 20 + (180 * k) / 0.8;
            s.scale.set(sc, sc, 1);
            (s.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k / 0.8);
          } else if (s.parent) {
            scene.remove(s);
          }
        }
        // shield flash 50→150 in 0.2s
        if (ex.flash) {
          if (k <= 0.2) {
            const sc = 50 + 500 * k;
            ex.flash.scale.set(sc, sc, 1);
            (ex.flash.material as THREE.SpriteMaterial).opacity = 0.95 * (1 - k / 0.2);
          } else {
            scene.remove(ex.flash);
            (ex.flash.material as THREE.SpriteMaterial).map?.dispose();
            (ex.flash.material as THREE.Material).dispose();
            ex.flash = null;
          }
        }
        // sparks 30 lines — high velocity, fade 0.3s
        for (let j = 0; j < ex.sparks.length; j++) {
          const line = ex.sparks[j];
          if (k > 0.3) {
            if (line.parent) scene.remove(line);
            continue;
          }
          const v = ex.sparkVel[j];
          const p0 = ex.pos.clone().add(v.clone().multiplyScalar(k));
          const p1 = p0.clone().add(v.clone().normalize().multiplyScalar(3.5));
          const attr = line.geometry.attributes.position as THREE.BufferAttribute;
          attr.setXYZ(0, p0.x, p0.y, p0.z);
          attr.setXYZ(1, p1.x, p1.y, p1.z);
          attr.needsUpdate = true;
          (line.material as THREE.LineBasicMaterial).opacity = Math.max(0, 1 - k / 0.3);
        }
        // debris 12 fragments — velocity outward + gravity, fade last 0.5s of 2s
        for (let j = 0; j < ex.debris.length; j++) {
          const m = ex.debris[j];
          const v = ex.debrisVel[j];
          m.position.add(v.clone().multiplyScalar(dt));
          v.y -= 18 * dt;
          m.rotation.x += dt * 2.4;
          m.rotation.y += dt * 1.8;
          m.rotation.z += dt * 1.1;
          if (k > 1.5) {
            const mat = m.material as THREE.MeshStandardMaterial;
            mat.opacity = Math.max(0, 1 - (k - 1.5) / 0.5);
            mat.needsUpdate = true;
          }
        }
        // remove burst sprites after 0.8s (geometry already, just material cleanup at 2s)
        if (k > 0.8) {
          for (const s of ex.burst) if (s.parent) { scene.remove(s); }
        }
        // final cleanup after 2s — dispose debris + sparks + burst mats
        if (k > 2.0) {
          for (const s of ex.burst) {
            const mat = s.material as THREE.SpriteMaterial;
            mat.map?.dispose();
            mat.dispose();
          }
          for (const m of ex.debris) {
            scene.remove(m);
            m.geometry.dispose();
            const mat = m.material as THREE.Material;
            (mat as unknown as { map?: THREE.Texture }).map?.dispose?.();
            mat.dispose();
          }
          for (const line of ex.sparks) {
            if (line.parent) scene.remove(line);
            line.geometry.dispose();
            (line.material as THREE.Material).dispose();
          }
          explosions.splice(ei, 1);
        }
      }
    }

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
    for (const ex of explosions) {
      for (const s of ex.burst) { if (s.parent) scene.remove(s); (s.material as THREE.Material).dispose(); }
      if (ex.flash && ex.flash.parent) scene.remove(ex.flash);
      if (ex.flash) (ex.flash.material as THREE.Material).dispose();
      for (const mm of ex.debris) { scene.remove(mm); mm.geometry.dispose(); (mm.material as THREE.Material).dispose(); }
      for (const line of ex.sparks) { scene.remove(line); line.geometry.dispose(); (line.material as THREE.Material).dispose(); }
    }
    explosions.length = 0;
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
// ARK-LIBRARIESCHIP (§18.5) — vessel-world procedural AAA+ stadium megastructure
// Fase 3 — FULL: 12 komponen, 4 ring industri (habitat/docking/platform/windows
// via InstancedMesh, EVE/Star Citizen scale), bukan arena olahraga.
// D-025 visual language — steel/steelHigh/amber/tech + windowWarm/habitatAmber
// ---------------------------------------------------------------------------
interface ArkBuildResult {
  group: THREE.Group;
  rings: THREE.Mesh[];
  ringGroups: THREE.Group[];
  engines: THREE.Sprite[];
  shields: { mesh: THREE.Mesh; sprite: THREE.Sprite }[];
  antennas: THREE.Mesh[];
  habitatMeshes: THREE.InstancedMesh[];
  windowMeshes: THREE.InstancedMesh[];
}

function buildArkLibrary(): ArkBuildResult {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: threeColor(colors.struct), metalness: 0.74, roughness: 0.38, emissive: threeColor("#0a1424"), emissiveIntensity: 0.35 });
  const steelHigh = new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), metalness: 0.76, roughness: 0.32 });
  const amber = new THREE.MeshStandardMaterial({ color: threeColor(colors.tactical), emissive: threeColor(colors.tactical), emissiveIntensity: 1.4 });
  const tech = new THREE.MeshStandardMaterial({ color: threeColor(colors.tech), emissive: threeColor(colors.tech), emissiveIntensity: 1.2 });
  const windowWarmMat = new THREE.MeshStandardMaterial({ color: threeColor("#ffd9a0"), emissive: threeColor("#ffd9a0"), emissiveIntensity: 1.8 });
  const habitatMat = new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), metalness: 0.72, roughness: 0.4, emissive: threeColor("#ffb36b"), emissiveIntensity: 0.45 });

  const rings: THREE.Mesh[] = [];
  const ringGroups: THREE.Group[] = [];
  const engines: THREE.Sprite[] = [];
  const shields: { mesh: THREE.Mesh; sprite: THREE.Sprite }[] = [];
  const antennas: THREE.Mesh[] = [];
  const habitatMeshes: THREE.InstancedMesh[] = [];
  const windowMeshes: THREE.InstancedMesh[] = [];

  // 1) KEEL — spine + 12 panel lines + 8 window strips (hard-surface)
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(320, 380, 4200, 48), steel);
  keel.rotation.z = Math.PI / 2;
  g.add(keel);
  for (let i = 0; i < 12; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3800, 1.2, 6), steelHigh);
    panel.position.set(0, 310 + (i % 3) * 22 * (i < 6 ? 1 : -1), -30 + (i % 4) * 14);
    panel.rotation.z = Math.PI / 2;
    panel.rotation.y = (i / 12) * Math.PI * 0.08;
    g.add(panel);
  }
  for (let i = 0; i < 8; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(180, 4, 2), windowWarmMat);
    win.position.set(-1600 + i * 460, 205, 0);
    g.add(win);
  }

  // 2) PROW + COCKPIT DOME + sensor array
  const prow = new THREE.Mesh(new THREE.ConeGeometry(200, 1100, 40), steelHigh);
  prow.rotation.z = -Math.PI / 2;
  prow.position.x = 2400;
  g.add(prow);
  const cockpitDome = new THREE.Mesh(
    new THREE.SphereGeometry(42, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshPhysicalMaterial({ color: threeColor("#a8d8ff"), metalness: 0.04, roughness: 0.07, transmission: 0.82, thickness: 1.1, ior: 1.45, transparent: true, opacity: 0.9, envMapIntensity: 1.3 })
  );
  cockpitDome.position.set(2100, 115, 0);
  cockpitDome.scale.set(1.4, 0.8, 1.2);
  g.add(cockpitDome);
  for (let i = 0; i < 3; i++) {
    const sens = new THREE.Mesh(new THREE.CylinderGeometry(4 + i, 6 + i, 18, 8), steelHigh);
    sens.rotation.x = Math.PI / 2;
    sens.position.set(2920 + i * 14, (i - 1) * 18, 0);
    g.add(sens);
  }

  // 3) STERN + ENGINE HOUSING (4 nacelles) + exhaust ports + glow
  const stern = new THREE.Mesh(new THREE.SphereGeometry(360, 40, 40), steel);
  stern.position.x = -2300;
  g.add(stern);
  const enginePositions = [[-2520, 110, 110], [-2520, 110, -110], [-2520, -110, 110], [-2520, -110, -110]] as const;
  for (const [x, y, z] of enginePositions) {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(62, 82, 220, 20), steelHigh);
    housing.rotation.z = Math.PI / 2;
    housing.position.set(x, y, z);
    g.add(housing);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: threeColor("#ff6a1a"), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(x - 140, y, z);
    glow.scale.set(180, 180, 1);
    g.add(glow);
    engines.push(glow);
  }
  for (let i = 0; i < 8; i++) {
    const port = new THREE.Mesh(new THREE.ConeGeometry(10, 18, 6), amber);
    port.rotation.z = Math.PI / 2;
    const ang = (i / 8) * Math.PI * 2;
    port.position.set(-2300 + Math.cos(ang) * 280, Math.sin(ang) * 280, Math.cos(ang * 2) * 40);
    port.lookAt(-2300, 0, 0);
    g.add(port);
  }

  // 4) SPIRE + observation deck + antenna + dish + light strip
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(90, 220, 1100, 36), steelHigh);
  spire.position.y = 700;
  g.add(spire);
  const spireCap = new THREE.Mesh(new THREE.ConeGeometry(120, 260, 36), amber);
  spireCap.position.y = 1380;
  g.add(spireCap);
  const obsDeck = new THREE.Mesh(new THREE.TorusGeometry(160, 22, 14, 40), steelHigh);
  obsDeck.rotation.x = Math.PI / 2;
  obsDeck.position.y = 860;
  g.add(obsDeck);
  const lightStrip = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1080, 8), amber);
  lightStrip.position.y = 700;
  g.add(lightStrip);
  for (let i = 0; i < 4; i++) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 220 + i * 70, 6), steelHigh);
    ant.position.set((i - 1.5) * 28, 1520 + i * 12, 0);
    g.add(ant);
    antennas.push(ant);
    if (i === 2) {
      const dish = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), steelHigh);
      dish.position.set((i - 1.5) * 28, 1650, 0);
      dish.rotation.x = Math.PI / 2;
      g.add(dish);
    }
  }

  // 5) RINGS — stadium megastructure (4×) — full industri via InstancedMesh
  const ringDummy = new THREE.Object3D();
  for (let r = 0; r < 4; r++) {
    const rg = new THREE.Group();
    const radius = 640 + r * 46;
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 26, 16, 72), r === 1 ? amber : steelHigh);
    ringMesh.rotation.x = 1.2 + r * 0.08;
    ringMesh.position.x = -400 + r * 500;
    rg.add(ringMesh);
    rings.push(ringMesh);

    // 5a) 8 support struts per ring
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      const strut = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 420), steelHigh);
      const sx = (-400 + r * 500) + Math.cos(ang) * radius * 0.5;
      const sy = Math.sin(ang) * radius * 0.5;
      strut.position.set(sx * 0.2, sy, Math.sin(ang) * 60);
      strut.lookAt(-400 + r * 500, 0, 0);
      rg.add(strut);
    }

    // 5b) Ring glow sprite + ambient light
    const ringGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: threeColor(r === 2 ? colors.glowStation : colors.glowEngine),
      transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    ringGlow.position.set(-400 + r * 500, 0, 0);
    ringGlow.scale.set(340, 340, 1);
    rg.add(ringGlow);

    // 5c) 24 habitat modules per ring — InstancedMesh
    {
      const habGeom = new THREE.BoxGeometry(30, 18, 26);
      const habMesh = new THREE.InstancedMesh(habGeom, habitatMat, 24);
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        ringDummy.position.set((-400 + r * 500) + Math.cos(ang) * (radius - 12), Math.sin(ang) * (radius - 12), 0);
        ringDummy.rotation.set(0, 0, ang + Math.PI / 2);
        ringDummy.updateMatrix();
        habMesh.setMatrixAt(i, ringDummy.matrix);
      }
      habMesh.instanceMatrix.needsUpdate = true;
      rg.add(habMesh);
      habitatMeshes.push(habMesh);
    }

    // 5d) 12 docking bay ports per ring
    for (let d = 0; d < 12; d++) {
      const ang = (d / 12) * Math.PI * 2;
      const port = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.TorusGeometry(16, 2.2, 8, 20, Math.PI), amber);
      frame.rotation.y = Math.PI / 2;
      const inner = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 8), new THREE.MeshStandardMaterial({ color: threeColor("#060a12"), roughness: 1 }));
      inner.position.x = 4;
      port.add(frame, inner);
      // marker light
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: threeColor(colors.tactical), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      marker.position.set(0, 14, 0);
      marker.scale.set(10, 10, 1);
      port.add(marker);
      port.position.set((-400 + r * 500) + Math.cos(ang) * (radius + 18), Math.sin(ang) * (radius + 18), 0);
      port.lookAt((-400 + r * 500) + Math.cos(ang) * (radius + 40), Math.sin(ang) * (radius + 40), 0);
      // bay door — 2 panels
      const doorL = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 9), steelHigh);
      doorL.position.set(0, 6, 4);
      const doorR = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 9), steelHigh);
      doorR.position.set(0, -6, 4);
      port.add(doorL, doorR);
      rg.add(port);
    }

    // 5e) 4 maintenance platforms per ring — flat deck + guard rail + hazard stripe
    for (let p = 0; p < 4; p++) {
      const ang = (p / 4) * Math.PI * 2 + 0.2;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(80, 3, 42), steelHigh);
      deck.position.set((-400 + r * 500) + Math.cos(ang) * (radius + 26), Math.sin(ang) * (radius + 26), 0);
      deck.rotation.z = ang;
      rg.add(deck);
      for (let k = 0; k < 2; k++) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(76, 1.2, 1.2), steelHigh);
        rail.position.set(deck.position.x, deck.position.y + (k ? 6 : -6), deck.position.z + 18);
        rail.rotation.z = ang;
        rg.add(rail);
      }
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(78, 0.6, 2), amber);
      stripe.position.set(deck.position.x, deck.position.y, deck.position.z + 19);
      stripe.rotation.z = ang;
      rg.add(stripe);
    }

    // 5f) 96 glowing windows per ring — InstancedMesh warm
    {
      const winGeom = new THREE.BoxGeometry(4.2, 2.6, 0.8);
      const winMesh = new THREE.InstancedMesh(winGeom, windowWarmMat, 96);
      for (let w = 0; w < 96; w++) {
        const ang = (w / 96) * Math.PI * 2 + (w % 2) * 0.02;
        const radJ = radius + (w % 3) * 4 - 4;
        ringDummy.position.set((-400 + r * 500) + Math.cos(ang) * radJ, Math.sin(ang) * radJ, (w % 2 ? 6 : -6));
        ringDummy.rotation.set(0, 0, ang);
        ringDummy.scale.set(1, 1, 1);
        ringDummy.updateMatrix();
        winMesh.setMatrixAt(w, ringDummy.matrix);
      }
      winMesh.instanceMatrix.needsUpdate = true;
      rg.add(winMesh);
      windowMeshes.push(winMesh);
    }

    g.add(rg);
    ringGroups.push(rg);
  }

  // 6) SPARS 6× — light strips + cross-bracing X
  for (let i = 0; i < 6; i++) {
    const x = -1000 + i * 400;
    const spar = new THREE.Mesh(new THREE.BoxGeometry(140, 30, 1200), steelHigh);
    spar.position.set(x, 0, 0);
    spar.rotation.y = Math.PI / 2;
    g.add(spar);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(138, 0.8, 2), amber);
    strip.position.set(x, 16, 0);
    strip.rotation.y = Math.PI / 2;
    g.add(strip);
    for (let k = 0; k < 2; k++) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1200), steelHigh);
      brace.position.set(x, 0, 0);
      brace.rotation.y = Math.PI / 2;
      brace.rotation.z = k ? 0.35 : -0.35;
      g.add(brace);
    }
  }

  // 7) WEAPON MOUNTS 4× — box + barrel
  const mountPositions = [[600, 90, 180], [600, 90, -180], [-300, -90, 180], [-300, -90, -180]] as const;
  for (const [x, y, z] of mountPositions) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(15, 8, 40), steelHigh);
    mount.position.set(x, y, z);
    g.add(mount);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 8), amber);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(x, y, z - 32);
    g.add(barrel);
  }

  // 8) DOCKING BAY — opening di hull tengah
  const bayFrame = new THREE.Mesh(new THREE.BoxGeometry(124, 84, 6), amber);
  bayFrame.position.set(200, -140, 0);
  g.add(bayFrame);
  const bayInner = new THREE.Mesh(new THREE.BoxGeometry(120, 80, 200), new THREE.MeshStandardMaterial({ color: threeColor("#04070d"), roughness: 1, metalness: 0 }));
  bayInner.position.set(200, -140, 40);
  g.add(bayInner);
  for (let k = 0; k < 2; k++) {
    const doorLine = new THREE.Mesh(new THREE.BoxGeometry(60, 2, 1), steelHigh);
    doorLine.position.set(200 + (k ? 30 : -30), -140 + (k ? 38 : -38), -2);
    g.add(doorLine);
  }

  // 9) CARGO PODS 4× — bawah hull + struts
  for (let i = 0; i < 4; i++) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(50, 40, 80), steel);
    pod.position.set(-800 + i * 520, -210, 0);
    g.add(pod);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 80, 6), steelHigh);
    strut.position.set(-800 + i * 520, -160, 0);
    g.add(strut);
  }

  // 10) ANTENNA ARRAYS 6× — thin + dish di 2
  for (let i = 0; i < 6; i++) {
    const h = 220 + (i % 3) * 90;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, h, 6), steelHigh);
    ant.position.set(-900 + i * 360, 380 + h / 2, (i % 2 ? 1 : -1) * 90);
    g.add(ant);
    antennas.push(ant);
    if (i === 1 || i === 4) {
      const dish = new THREE.Mesh(new THREE.SphereGeometry(20, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), steelHigh);
      dish.position.set(-900 + i * 360, 380 + h + 12, (i % 2 ? 1 : -1) * 90);
      dish.rotation.x = Math.PI / 2;
      g.add(dish);
    }
  }

  // 11) SHIELD GENERATORS 6× — perimeter + glow + pulse
  const shieldPos = [[900, 160, 0], [0, 160, 220], [-800, 160, 0], [900, -160, 0], [0, -160, -220], [-800, -160, 0]] as const;
  for (let i = 0; i < shieldPos.length; i++) {
    const [x, y, z] = shieldPos[i];
    const gen = new THREE.Mesh(new THREE.SphereGeometry(15, 12, 10), tech);
    gen.position.set(x, y, z);
    g.add(gen);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: threeColor(colors.tech), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(x, y, z);
    glow.scale.set(38, 38, 1);
    g.add(glow);
    shields.push({ mesh: gen, sprite: glow });
  }

  // 12) OBSERVATORY DOME — atas hull tengah + internal structure
  const obs = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshPhysicalMaterial({ color: threeColor("#c8e8ff"), metalness: 0.02, roughness: 0.06, transmission: 0.74, thickness: 0.9, transparent: true, opacity: 0.92 }));
  obs.position.set(400, 210, 0);
  g.add(obs);
  const obsInner = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 18), steelHigh);
  obsInner.position.set(400, 210, 0);
  g.add(obsInner);

  return { group: g, rings, ringGroups, engines, shields, antennas, habitatMeshes, windowMeshes };
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