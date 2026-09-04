// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/bootstrap.ts — runtime foundation + shared state (SceneContext).
//
// Aturan: modul domain TIDAK boleh saling import state internal. Semua state
// yang dulu jadi closure di initScene3D sekarang jadi field eksplisit di
// SceneContext — dibuat di sini (createBase), diisi builder tiap domain,
// diorkestrasi index.ts. Satu-satunya arah dependensi modul:
//   domain/*.ts --(import type)--> bootstrap.ts (SceneContext)
// bootstrap TIDAK import modul domain (no cycle).
// Texture helper bersama (makeGlowTexture) + disposeGroup tinggal di sini
// karena dipakai lintas domain (nebula/suns/vessels/stations/explosions/ark).

import * as THREE from "three";
import { colors, nebulaSeed, threeColor } from "../../ui/tokens";
import type { GameSettings } from "../settings";
import type { VesselEntity } from "../../../../../packages/gameserver/types";
import { mulberry32 } from "./rng";
import type { OrbitSpec } from "./orbital";
import type { Planet3D } from "./planets";
import type { Explosion } from "./explosions";

/** Satu sun: mesh + glow sprite + light + orbit (binary/trinary §2.1). */
export interface Sun3D {
  sun: THREE.Mesh;
  glow: THREE.Sprite;
  light: THREE.DirectionalLight;
  orbit: OrbitSpec;
}

/** Meteor: garis + start + velocity + umur (§2.4). */
export interface Meteor3D {
  line: THREE.Line;
  start: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  ttl: number;
}

/** Backdrop planet jauh — sense of scale (§2.2). */
export interface Backdrop3D {
  mesh: THREE.Mesh;
  orbit: OrbitSpec;
  drift: number;
}

/** Referensi animasi Ark (dipakai updater ark.ts). */
export interface ArkRefs {
  group: THREE.Group;
  rings: THREE.Mesh[];
  ringGroups: THREE.Group[];
  engines: THREE.Sprite[];
  shields: { mesh: THREE.Mesh; sprite: THREE.Sprite }[];
  antennas: THREE.Mesh[];
}

/**
 * Seluruh state yang dulu closure di initScene3D. Field diisi bertahap
 * sesuai urutan build di index.ts (urutan SAMA dengan file lama —
 * konsumsi rand deterministik + urutan add ke scene dipertahankan).
 */
export interface SceneContext {
  // --- base (createBase) ---
  target: HTMLElement | null;
  width: number;
  height: number;
  DPR: number;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  rand: () => number;
  settings: GameSettings;
  // --- camera.ts ---
  camera: THREE.PerspectiveCamera | null;
  camMode: string;
  lookYaw: number;
  lookPitch: number;
  // --- post.ts ---
  composer: import("three/examples/jsm/postprocessing/EffectComposer.js").EffectComposer | null;
  bloomPass: import("three/examples/jsm/postprocessing/UnrealBloomPass.js").UnrealBloomPass | null;
  pmrem: THREE.PMREMGenerator | null;
  pmremTarget: THREE.WebGLRenderTarget | null;
  envFrame: number;
  // --- stars.ts (statis, tanpa updater) ---
  // --- nebula.ts ---
  nebulaTex: THREE.Texture | null;
  nebulaSprites: THREE.Sprite[];
  // --- suns.ts ---
  suns: Sun3D[];
  coronaTex: THREE.Texture | null;
  starBodies: number;
  ambient: THREE.AmbientLight | null;
  // --- planets.ts ---
  planets: Planet3D[];
  backdrops: Backdrop3D[];
  planetCount: number;
  // --- belt.ts ---
  belt: THREE.InstancedMesh | null;
  beltCount: number;
  // --- cosmic.ts ---
  meteors: Meteor3D[];
  meteorMat: THREE.LineBasicMaterial | null;
  auroraSpr: THREE.Sprite | null;
  auroraSprB: THREE.Sprite | null;
  // --- ark.ts ---
  ark: ArkRefs | null;
  // --- entities (vessels.ts / stations.ts) ---
  vessels: Map<string, THREE.Group>;
  stations: Map<string, THREE.Group>;
  prev: Map<string, THREE.Vector3>;
  cur: Map<string, THREE.Vector3>;
  anchor: THREE.Vector3;
  firstVesselRef: VesselEntity | undefined;
  lastTick: number;
  lastSnapshotAt: number;
  // --- explosions.ts ---
  explosions: Explosion[];
  sfxHandler: ((kind: "explosion" | "shield" | "debris") => void) | null;
  // --- loop (index.ts) ---
  updaters: Array<(t: number, tick: number) => void>;
  running: boolean;
  rafId: number;
  lastFrame: number;
}

/** Base runtime: scene + renderer + rand + semua koleksi state (kosong). */
export function createBase(target: HTMLElement | null, width: number, height: number, DPR: number, settings: GameSettings): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(threeColor(colors.voidDeep));
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  if (target) target.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  return {
    target, width, height, DPR, scene, renderer,
    rand: mulberry32(nebulaSeed),
    settings,
    camera: null, camMode: "follow", lookYaw: 0, lookPitch: 0,
    composer: null, bloomPass: null,
    pmrem,
    pmremTarget: null, envFrame: 0,
    nebulaTex: null, nebulaSprites: [],
    suns: [], coronaTex: null, starBodies: 1, ambient: null,
    planets: [], backdrops: [], planetCount: 9,
    belt: null, beltCount: 6000,
    meteors: [], meteorMat: null, auroraSpr: null, auroraSprB: null,
    ark: null,
    vessels: new Map(), stations: new Map(),
    prev: new Map(), cur: new Map(),
    anchor: new THREE.Vector3(0, 0, 0),
    firstVesselRef: undefined, lastTick: 0, lastSnapshotAt: 0,
    explosions: [], sfxHandler: null,
    updaters: [], running: false, rafId: 0, lastFrame: 0,
  };
}

/** Radial glow sprite generik (canvas, no asset) — dipakai lintas domain. */
export function makeGlowTexture(): THREE.Texture {
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

/** Dispose grup + geometri/material/texture-nya (dedup via Set). */
export function disposeGroup(g: THREE.Group): void {
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
