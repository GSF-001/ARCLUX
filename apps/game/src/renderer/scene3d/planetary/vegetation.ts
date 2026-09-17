// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// planetary/vegetation.ts - 10.V A1 vegetation — AAA+ rebuild.
// Cross-plane pine trees, instanced grass blades, icosahedron canopy
// with noise, bark/leaf canvas textures, phased sway + wetness.
// Five growth stages respond to wind gusts and precipitation.
// Visual-only: reads EnvironmentalContext wind and precipitation.

import * as THREE from "three";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export type VegetationKind = "grass" | "small" | "bush" | "branch" | "tree";

const COUNTS: Record<VegetationKind, number> = { grass: 80, small: 24, bush: 12, branch: 8, tree: 4 };
const TOTAL = 80 + 24 + 12 + 8 + 4;
const FIELD_HALF = 100;
const WET_TINT = 0x1a2a1a;
const WET_DARKEN = 0.15;

export interface VegetationInstance {
  kind: VegetationKind;
  mesh: THREE.Object3D;
  basePos: THREE.Vector3;
  baseColor: THREE.Color;
  phase: number;
}

export interface VegetationSystem {
  group: THREE.Group;
  instances: VegetationInstance[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Canvas textures (bark/leaf — pola makeCloudTexture) ───────────

function makeBarkTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Dark brown bark base
  ctx.fillStyle = "#3d2f24";
  ctx.fillRect(0, 0, size, size);
  // Vertical bark ridges
  for (let i = 0; i < 12; i++) {
    const x = (i / 12) * size + (Math.random() - 0.5) * 4;
    const w = 1.5 + Math.random() * 2;
    ctx.fillStyle = `rgba(20,12,6,${0.3 + Math.random() * 0.4})`;
    ctx.fillRect(x, 0, w, size);
  }
  // Highlight ridges
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * size;
    ctx.fillStyle = `rgba(90,70,50,${0.15 + Math.random() * 0.2})`;
    ctx.fillRect(x, 0, 1, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeLeafTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Green leaf base with variation
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "#4a8a3a");
  grad.addColorStop(0.5, "#3a7a2a");
  grad.addColorStop(1, "#2a5a1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Leaf veins
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.strokeStyle = `rgba(30,60,20,${0.2 + Math.random() * 0.3})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.lineTo(size / 2 + Math.cos(angle) * size * 0.45, size / 2 + Math.sin(angle) * size * 0.45);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ─── Shared textures (created once) ────────────────────────────────

let _barkTex: THREE.CanvasTexture | null = null;
let _leafTex: THREE.CanvasTexture | null = null;
function barkTex() { if (!_barkTex) _barkTex = makeBarkTexture(); return _barkTex; }
function leafTex() { if (!_leafTex) _leafTex = makeLeafTexture(); return _leafTex; }

// ─── Build mesh per kind (A1 upgrade) ─────────────────────────────

const _wetColor = new THREE.Color(WET_TINT);
const _tintScratch = new THREE.Color();

function kindSwayFactor(kind: VegetationKind): number {
  if (kind === "grass") return 2.0;
  if (kind === "small") return 1.6;
  if (kind === "bush") return 1.2;
  if (kind === "branch") return 0.7;
  return 0.4;
}

/**
 * A1 — Pinus cross-plane: two intersecting planes with bark trunk
 * + leaf canopy. Cheaper than true 3D but reads as volumetric.
 */
function buildPinus(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  // Trunk — tapered cylinder with bark texture
  const trunkH = 4 + rng() * 2;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.3, trunkH, 6),
    new THREE.MeshStandardMaterial({ map: barkTex(), roughness: 0.9, metalness: 0.05 }),
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);

  // Canopy — cross-plane leaf texture (2 intersecting quads)
  const canopySize = 2.5 + rng() * 1.5;
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex(),
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.3,
    roughness: 0.8,
    metalness: 0.02,
    emissive: 0x1a3a0a,
    emissiveIntensity: 0.15,
  });
  const planeA = new THREE.Mesh(new THREE.PlaneGeometry(canopySize, canopySize * 0.8), leafMat);
  planeA.position.y = trunkH * 0.7;
  planeA.rotation.y = rng() * Math.PI;
  planeA.castShadow = true;
  g.add(planeA);
  const planeB = new THREE.Mesh(new THREE.PlaneGeometry(canopySize, canopySize * 0.8), leafMat.clone());
  (planeB.material as THREE.MeshStandardMaterial).map = leafTex();
  planeB.position.y = trunkH * 0.7;
  planeB.rotation.y = rng() * Math.PI + Math.PI / 2;
  planeB.castShadow = true;
  g.add(planeB);

  return g;
}

/**
 * A1 — Icosahedron canopy bush: noise-displaced icosahedron
 * reads as leafy volume without heavy geometry.
 */
function buildCanopyBush(rng: () => number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(1.2, 1);
  // Displace vertices slightly for organic noise
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i);
    const noise = 1 + (rng() - 0.5) * 0.25;
    pos.setXYZ(i, nx * noise, ny * noise, nz * noise);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: leafTex(),
    roughness: 0.75,
    metalness: 0.02,
    emissive: 0x1a3a0a,
    emissiveIntensity: 0.12,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function buildMesh(kind: VegetationKind, rng: () => number): { mesh: THREE.Object3D; color: number } {
  if (kind === "grass") {
    // A1 — Instanced grass blade: thin tall plane with StandardMaterial (bunuh Basic flat)
    const g = new THREE.PlaneGeometry(0.15, 0.9);
    const m = new THREE.MeshStandardMaterial({
      color: 0x3a7a4a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      roughness: 0.85,
      metalness: 0.02,
      emissive: 0x0a1a0a,
      emissiveIntensity: 0.1,
    });
    return { mesh: new THREE.Mesh(g, m), color: 0x3a7a4a };
  }
  if (kind === "small") {
    const g = new THREE.SphereGeometry(0.6, 8, 6);
    const m = new THREE.MeshStandardMaterial({
      map: leafTex(),
      roughness: 0.75,
      metalness: 0.02,
      emissive: 0x1a3a0a,
      emissiveIntensity: 0.12,
    });
    return { mesh: new THREE.Mesh(g, m), color: 0x3a7a4a };
  }
  if (kind === "bush") {
    return { mesh: buildCanopyBush(rng), color: 0x2e5a3a };
  }
  if (kind === "branch") {
    const g = new THREE.CylinderGeometry(0.12, 0.18, 2.5, 6);
    const m = new THREE.MeshStandardMaterial({ map: barkTex(), roughness: 0.9, metalness: 0.05 });
    return { mesh: new THREE.Mesh(g, m), color: 0x4a3a2a };
  }
  // A1 — Tree = pinus cross-plane
  return { mesh: buildPinus(rng), color: 0x3d2f24 };
}

/** Build the pooled instances. Seed keeps chunk regeneration identical. */
export function createVegetationSystem(seed = 0xe9e7): VegetationSystem {
  const group = new THREE.Group();
  group.name = "vegetationSystem";
  const instances: VegetationInstance[] = [];
  const rng = mulberry32(seed);
  for (const kind of Object.keys(COUNTS) as VegetationKind[]) {
    for (let i = 0; i < COUNTS[kind]; i++) {
      const { mesh, color } = buildMesh(kind, rng);
      mesh.position.set((rng() - 0.5) * FIELD_HALF * 2, 0, (rng() - 0.5) * FIELD_HALF * 2);
      mesh.name = `veg-${kind}-${i}`;
      group.add(mesh);
      instances.push({
        kind,
        mesh,
        basePos: mesh.position.clone(),
        baseColor: new THREE.Color(color),
        phase: rng(),
      });
    }
  }
  return { group, instances };
}

/**
 * Advance vegetation one frame.
 * Phased sway: grass responds fast (2Hz), trees slow (0.4Hz).
 * Wetness tints from base color every frame (drying restores original).
 */
export function tickVegetation(
  sys: VegetationSystem,
  ctx: EnvironmentalContext,
  dt: number,
  timeSec: number,
): void {
  void dt;
  const wind = ctx.wind;
  const rainWet = ctx.weather.precipitationIntensity;
  const gust = wind.gustStrength;
  const turb = wind.turbulence;
  const spread = 0.7 + wind.localVariation * 0.6;
  const wet = rainWet > 0.1 ? Math.min(1, rainWet) * WET_DARKEN : 0;

  for (const inst of sys.instances) {
    const factor = kindSwayFactor(inst.kind);
    const gustPhase = Math.sin(timeSec * 2 * factor + inst.phase * Math.PI * 2 + wind.direction) * gust;
    const turbPhase = Math.sin(timeSec + inst.phase * 6) * turb * 0.5;
    const sway = (gustPhase * 0.4 + turbPhase * 0.15) * wind.speed * 0.04 * factor * spread;

    if (inst.kind === "grass" || inst.kind === "small") {
      inst.mesh.rotation.z = sway;
      inst.mesh.rotation.x = sway * 0.5;
    } else if (inst.kind === "tree") {
      // Pinus: lean whole group
      inst.mesh.rotation.z = sway * 0.3;
      inst.mesh.rotation.x = sway * 0.15;
      // Cross-plane canopy sways slightly more
      inst.mesh.children.forEach((child, ci) => {
        if (ci > 0) child.rotation.y += sway * 0.02;
      });
    } else {
      inst.mesh.position.x = inst.basePos.x + Math.cos(wind.direction) * sway * 2;
      inst.mesh.position.z = inst.basePos.z + Math.sin(wind.direction) * sway * 2;
    }

    // Wetness tint — works on all material types
    const mesh = inst.mesh;
    if (mesh instanceof THREE.Mesh) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.color) {
        _tintScratch.copy(inst.baseColor);
        if (wet > 0) _tintScratch.lerp(_wetColor, wet);
        mat.color.copy(_tintScratch);
      }
    }
    // For groups (pinus), tint the first child material
    if (mesh instanceof THREE.Group && mesh.children.length > 0) {
      const childMat = (mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (childMat && "color" in childMat) {
        _tintScratch.copy(inst.baseColor);
        if (wet > 0) _tintScratch.lerp(_wetColor, wet);
        childMat.color.copy(_tintScratch);
      }
    }
  }
}

/** Hide instances beyond maxDist from center. Returns the hidden count. */
export function cullVegetationByDistance(
  sys: VegetationSystem,
  maxDist: number,
  center: { x: number; z: number },
): number {
  let culled = 0;
  for (const inst of sys.instances) {
    const d = Math.hypot(inst.basePos.x - center.x, inst.basePos.z - center.z);
    const show = d < maxDist;
    inst.mesh.visible = show;
    if (!show) culled++;
  }
  return culled;
}

/** Active instance budget per quality level (total pool is 128). */
export function vegetationBudgetForQuality(level: string): number {
  if (level === "CINEMATIC") return TOTAL;
  if (level === "ULTRA") return TOTAL;
  if (level === "HIGH") return 80;
  if (level === "MEDIUM") return 32;
  return 8;
}
