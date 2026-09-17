// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/weapons.ts — 10.V W1 weapon VFX kit.
// 5 archetypes (Projectile/Beam/Missile/Drone/Area) + impact taxonomy.
// Object pool per type (pre-alloc, reuse — no new Geometry per frame).
// Pool caps §4.4.3: tracer ≤64, beam ≤8, missile ≤12, impact ≤200.
// Budget: update ≤0.8ms/frame HIGH. LOW fallback: tracer + flash only.
// Visual-only: reads shield state from sim, never writes authority.

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import type { SceneContext } from "./bootstrap";
import { makeGlowTexture } from "./bootstrap";

// ─── Pool caps §4.4.3 ─────────────────────────────────────────────
const TRACER_CAP = 64;
const BEAM_CAP = 8;
const MISSILE_CAP = 12;
const IMPACT_CAP = 200;

// ─── Shared textures (created once, reused across all pools) ───────
let _sharedGlow: THREE.Texture | null = null;
function sharedGlow(): THREE.Texture {
  if (!_sharedGlow) _sharedGlow = makeGlowTexture();
  return _sharedGlow;
}

// ─── Pool item state ───────────────────────────────────────────────

interface TracerPoolItem {
  line: THREE.Line;
  active: boolean;
  from: THREE.Vector3;
  to: THREE.Vector3;
  speed: number;
  t: number;
  ttl: number;
  tint: number;
}

interface BeamPoolItem {
  mesh: THREE.Mesh;
  glow: THREE.Sprite;
  active: boolean;
  from: THREE.Vector3;
  to: THREE.Vector3;
  heat: number;
  t: number;
  ttl: number;
}

interface MissilePoolItem {
  body: THREE.Mesh;
  glow: THREE.Sprite;
  trail: THREE.Line;
  active: boolean;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  t: number;
  ttl: number;
  trailPoints: THREE.Vector3[];
  tint: number;
}

interface ImpactPoolItem {
  sprites: THREE.Sprite[];
  lines: THREE.Line[];
  active: boolean;
  pos: THREE.Vector3;
  t: number;
  ttl: number;
  kind: ImpactKind;
}

// ─── Public types ──────────────────────────────────────────────────

export type ImpactKind = "shield" | "sparks" | "electrical" | "smoke" | "directional";
export type WeaponArchetype = "projectile" | "beam" | "missile" | "drone" | "area";

export interface WeaponPool {
  tracers: TracerPoolItem[];
  beams: BeamPoolItem[];
  missiles: MissilePoolItem[];
  impacts: ImpactPoolItem[];
  group: THREE.Group;
}

// ─── Build geometry/material templates (shared, not per-spawn) ─────

const _tracerGeo = new THREE.BufferGeometry();
const _tracerPositions = new Float32Array(6); // 2 points × 3
_tracerGeo.setAttribute("position", new THREE.BufferAttribute(_tracerPositions, 3));

const _beamGeo = new THREE.PlaneGeometry(1, 1); // scaled per-beam
const _beamMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const _missileBodyGeo = new THREE.ConeGeometry(1.2, 6, 6);
const _missileBodyMat = new THREE.MeshStandardMaterial({
  color: 0x888888,
  metalness: 0.7,
  roughness: 0.3,
});

const _shockwaveGeo = new THREE.RingGeometry(0.5, 1, 32);
const _shockwaveMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.7,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
});

// ─── Create pool ───────────────────────────────────────────────────

function createTracerLines(): TracerPoolItem[] {
  const items: TracerPoolItem[] = [];
  for (let i = 0; i < TRACER_CAP; i++) {
    const mat = new THREE.LineBasicMaterial({
      color: 0x52c8ff,
      transparent: true,
      opacity: 0,
      linewidth: 1,
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.frustumCulled = false;
    items.push({
      line,
      active: false,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      speed: 0,
      t: 0,
      ttl: 0,
      tint: 0x52c8ff,
    });
  }
  return items;
}

function createBeams(): BeamPoolItem[] {
  const items: BeamPoolItem[] = [];
  for (let i = 0; i < BEAM_CAP; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(_beamGeo.clone(), mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sharedGlow(),
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.visible = false;
    items.push({
      mesh,
      glow,
      active: false,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      heat: 0,
      t: 0,
      ttl: 0,
    });
  }
  return items;
}

function createMissiles(): MissilePoolItem[] {
  const items: MissilePoolItem[] = [];
  for (let i = 0; i < MISSILE_CAP; i++) {
    const body = new THREE.Mesh(_missileBodyGeo, _missileBodyMat);
    body.visible = false;
    body.frustumCulled = false;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sharedGlow(),
      color: 0xff6a00,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.visible = false;
    const trailMat = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.4,
    });
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(180), 3)); // 60 points
    const trail = new THREE.Line(trailGeo, trailMat);
    trail.visible = false;
    trail.frustumCulled = false;
    items.push({
      body,
      glow,
      trail,
      active: false,
      pos: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      speed: 0,
      t: 0,
      ttl: 0,
      trailPoints: [],
      tint: 0xff6a00,
    });
  }
  return items;
}

function createImpacts(): ImpactPoolItem[] {
  const items: ImpactPoolItem[] = [];
  for (let i = 0; i < IMPACT_CAP; i++) {
    const sprites: THREE.Sprite[] = [];
    const lines: THREE.Line[] = [];
    // 1 flash sprite + 2 spark lines pre-allocated per impact slot
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sharedGlow(),
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    flash.visible = false;
    sprites.push(flash);
    for (let j = 0; j < 2; j++) {
      const mat = new THREE.LineBasicMaterial({
        color: 0xffd67a,
        transparent: true,
        opacity: 0,
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      lines.push(line);
    }
    items.push({
      sprites,
      lines,
      active: false,
      pos: new THREE.Vector3(),
      t: 0,
      ttl: 0,
      kind: "sparks",
    });
  }
  return items;
}

/** Create the full weapon pool. Call once at init. */
export function createWeaponPool(): WeaponPool {
  const group = new THREE.Group();
  group.name = "weaponPool";
  const tracers = createTracerLines();
  const beams = createBeams();
  const missiles = createMissiles();
  const impacts = createImpacts();
  // Add all pool meshes to group so they're in the scene
  for (const t of tracers) group.add(t.line);
  for (const b of beams) { group.add(b.mesh); group.add(b.glow); }
  for (const m of missiles) { group.add(m.body); group.add(m.glow); group.add(m.trail); }
  for (const im of impacts) {
    for (const s of im.sprites) group.add(s);
    for (const l of im.lines) group.add(l);
  }
  return { tracers, beams, missiles, impacts, group };
}

// ─── Acquire from pool (recycle oldest inactive, or skip if full) ──

function acquireTracer(pool: WeaponPool): TracerPoolItem | null {
  // First try inactive
  for (const t of pool.tracers) if (!t.active) return t;
  // All full — recycle oldest (index 0)
  const oldest = pool.tracers[0];
  oldest.active = false;
  return oldest;
}

function acquireBeam(pool: WeaponPool): BeamPoolItem | null {
  for (const b of pool.beams) if (!b.active) return b;
  const oldest = pool.beams[0];
  oldest.active = false;
  return oldest;
}

function acquireMissile(pool: WeaponPool): MissilePoolItem | null {
  for (const m of pool.missiles) if (!m.active) return m;
  const oldest = pool.missiles[0];
  oldest.active = false;
  return oldest;
}

function acquireImpact(pool: WeaponPool): ImpactPoolItem | null {
  for (const im of pool.impacts) if (!im.active) return im;
  // impacts pool is large — recycle oldest
  const oldest = pool.impacts[0];
  oldest.active = false;
  return oldest;
}

// ─── Spawn functions ───────────────────────────────────────────────

const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();

/**
 * W1.1 — Projectile tracer: thin cyan/amber line from→to.
 * Speed: 1200 units/s. TTL: distance/speed + 0.1s fade.
 * LOW fallback: flash sprite only (no line trail).
 */
export function spawnProjectileTracer(
  ctx: SceneContext,
  from: THREE.Vector3,
  to: THREE.Vector3,
  tint: number = 0x52c8ff,
): void {
  const pool = ctx.weaponPool;
  if (!pool) return;
  const isLow = ctx.settings.preset === "LOW";
  const item = acquireTracer(pool);
  if (!item) return;

  item.from.copy(from);
  item.to.copy(to);
  item.tint = tint;
  item.t = 0;
  const dist = from.distanceTo(to);
  item.speed = 1200;
  item.ttl = dist / item.speed + 0.1;
  item.active = true;

  const line = item.line;
  const mat = line.material as THREE.LineBasicMaterial;
  mat.color.setHex(tint);
  mat.opacity = isLow ? 0 : 1;
  line.visible = !isLow;

  const pos = line.geometry.attributes.position as THREE.BufferAttribute;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, from.x, from.y, from.z);
  pos.needsUpdate = true;
}

/**
 * W1.1 — Beam: continuous quad from→to + bloom glow sprite + shimmer.
 * Telegraph: glow charges 200ms BEFORE beam appears (EVE-style).
 * TTL: 0.8s sustained + 0.2s fade. Width scales with heat param.
 */
export function spawnBeam(
  ctx: SceneContext,
  from: THREE.Vector3,
  to: THREE.Vector3,
  width: number = 3,
  heat: number = 0.5,
): void {
  const pool = ctx.weaponPool;
  if (!pool) return;
  const isLow = ctx.settings.preset === "LOW";
  if (isLow) {
    // LOW: just a flash sprite at midpoint
    spawnMuzzle(ctx, from, "beam");
    return;
  }

  const item = acquireBeam(pool);
  if (!item) return;

  item.from.copy(from);
  item.to.copy(to);
  item.heat = heat;
  item.t = -0.2; // negative = telegraph phase (glow only, no beam)
  item.ttl = 1.0; // 0.2 telegraph + 0.8 beam
  item.active = true;

  // Position beam mesh at midpoint, orient toward target
  _mid.addVectors(from, to).multiplyScalar(0.5);
  item.mesh.position.copy(_mid);
  item.mesh.lookAt(to);
  item.mesh.scale.set(1, width * (0.5 + heat), 1);
  item.mesh.visible = false; // hidden during telegraph

  // Glow at source (telegraph indicator)
  item.glow.position.copy(from);
  item.glow.scale.set(width * 8, width * 8, 1);
  item.glow.visible = true;
  (item.glow.material as THREE.SpriteMaterial).color.setHex(
    heat > 0.7 ? 0xff4a2a : 0x52c8ff,
  );
}

/**
 * W1.1 — Missile: small body + engine glow + spiral smoke trail.
 * TTL: 3s (fly to infinity, or until impact callback). Trail: 60 points max.
 */
export function spawnMissile(
  ctx: SceneContext,
  from: THREE.Vector3,
  dir: THREE.Vector3,
  tint: number = 0xff6a00,
): void {
  const pool = ctx.weaponPool;
  if (!pool) return;
  const isLow = ctx.settings.preset === "LOW";
  if (isLow) {
    spawnMuzzle(ctx, from, "missile");
    return;
  }

  const item = acquireMissile(pool);
  if (!item) return;

  item.pos.copy(from);
  item.dir.copy(dir).normalize();
  item.speed = 400;
  item.t = 0;
  item.ttl = 3.0;
  item.tint = tint;
  item.trailPoints = [from.clone()];
  item.active = true;

  item.body.position.copy(from);
  item.body.lookAt(from.clone().add(item.dir));
  item.body.visible = true;

  item.glow.position.copy(from).add(item.dir.clone().multiplyScalar(-3));
  item.glow.scale.set(12, 12, 1);
  (item.glow.material as THREE.SpriteMaterial).color.setHex(tint);
  (item.glow.material as THREE.SpriteMaterial).opacity = 0.9;
  item.glow.visible = true;

  // Reset trail
  const trailPos = item.trail.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < 60; i++) {
    trailPos.setXYZ(i, from.x, from.y, from.z);
  }
  trailPos.needsUpdate = true;
  (item.trail.material as THREE.LineBasicMaterial).color.setHex(0x666666);
  item.trail.visible = true;
}

/**
 * W1.2 — Muzzle flash at hardpoint position. Flash 60ms + puff.
 * kind: "projectile" | "beam" | "missile" | "drone" | "area"
 */
export function spawnMuzzle(
  ctx: SceneContext,
  hardpointPos: THREE.Vector3,
  kind: WeaponArchetype = "projectile",
): void {
  const pool = ctx.weaponPool;
  if (!pool) return;
  // Reuse an impact slot for the muzzle flash (short-lived, ≤0.1ms budget)
  const item = acquireImpact(pool);
  if (!item) return;

  item.pos.copy(hardpointPos);
  item.t = 0;
  item.ttl = 0.08; // 60-80ms
  item.kind = "sparks"; // reuse sparks visual
  item.active = true;

  const flash = item.sprites[0];
  flash.position.copy(hardpointPos);
  flash.scale.set(15, 15, 1);
  const flashMat = flash.material as THREE.SpriteMaterial;
  flashMat.color.setHex(kind === "beam" ? 0x88ccff : kind === "missile" ? 0xff8844 : 0xffd67a);
  flashMat.opacity = 0.95;
  flash.visible = true;

  // Puff lines
  for (const line of item.lines) {
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
    );
    pos.setXYZ(0, hardpointPos.x, hardpointPos.y, hardpointPos.z);
    pos.setXYZ(1, hardpointPos.x + offset.x, hardpointPos.y + offset.y, hardpointPos.z + offset.z);
    pos.needsUpdate = true;
    (line.material as THREE.LineBasicMaterial).opacity = 0.6;
    line.visible = true;
  }
}

/**
 * W1.3 — Impact at position. kind = shield|sparks|electrical|smoke|directional.
 * surface normal used for directional cone. Auto-recycle ≤1s.
 */
export function spawnImpact(
  ctx: SceneContext,
  pos: THREE.Vector3,
  kind: ImpactKind = "sparks",
  surfaceNormal?: THREE.Vector3,
): void {
  const pool = ctx.weaponPool;
  if (!pool) return;
  const isLow = ctx.settings.preset === "LOW";

  const item = acquireImpact(pool);
  if (!item) return;

  item.pos.copy(pos);
  item.t = 0;
  item.kind = kind;
  item.active = true;

  const flash = item.sprites[0];

  switch (kind) {
    case "shield": {
      // Blue flash + hexagonal-ish sprite
      item.ttl = isLow ? 0.15 : 0.4;
      flash.position.copy(pos);
      flash.scale.set(30, 30, 1);
      (flash.material as THREE.SpriteMaterial).color.setHex(0x4488ff);
      (flash.material as THREE.SpriteMaterial).opacity = 0.9;
      flash.visible = true;
      // Shield hex lines
      if (!isLow) {
        for (let k = 0; k < item.lines.length; k++) {
          const line = item.lines[k];
          const angle = (k / item.lines.length) * Math.PI * 2;
          const r = 15 + k * 5;
          const p = line.geometry.attributes.position as THREE.BufferAttribute;
          p.setXYZ(0, pos.x, pos.y, pos.z);
          p.setXYZ(1, pos.x + Math.cos(angle) * r, pos.y + Math.sin(angle) * r, pos.z);
          p.needsUpdate = true;
          (line.material as THREE.LineBasicMaterial).color.setHex(0x4488ff);
          (line.material as THREE.LineBasicMaterial).opacity = 0.7;
          line.visible = true;
        }
      }
      break;
    }
    case "sparks": {
      // Yellow sparks — line streaks
      item.ttl = isLow ? 0.1 : 0.3;
      flash.position.copy(pos);
      flash.scale.set(12, 12, 1);
      (flash.material as THREE.SpriteMaterial).color.setHex(0xffd67a);
      (flash.material as THREE.SpriteMaterial).opacity = 0.8;
      flash.visible = true;
      for (const line of item.lines) {
        const dir = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        ).normalize();
        const len = 6 + Math.random() * 10;
        const p = line.geometry.attributes.position as THREE.BufferAttribute;
        p.setXYZ(0, pos.x, pos.y, pos.z);
        p.setXYZ(1, pos.x + dir.x * len, pos.y + dir.y * len, pos.z + dir.z * len);
        p.needsUpdate = true;
        (line.material as THREE.LineBasicMaterial).color.setHex(0xffd67a);
        (line.material as THREE.LineBasicMaterial).opacity = 0.9;
        line.visible = true;
      }
      break;
    }
    case "electrical": {
      // Purple zigzag lines 150ms
      item.ttl = isLow ? 0.05 : 0.15;
      flash.position.copy(pos);
      flash.scale.set(18, 18, 1);
      (flash.material as THREE.SpriteMaterial).color.setHex(0xaa44ff);
      (flash.material as THREE.SpriteMaterial).opacity = 0.85;
      flash.visible = true;
      for (const line of item.lines) {
        const segs = 4;
        const positions: number[] = [];
        let cx = pos.x, cy = pos.y, cz = pos.z;
        for (let s = 0; s <= segs; s++) {
          positions.push(cx, cy, cz);
          cx += (Math.random() - 0.5) * 12;
          cy += (Math.random() - 0.5) * 12;
          cz += (Math.random() - 0.5) * 12;
        }
        const geo = line.geometry;
        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        // Fill what we can (max 2 points in pre-alloc, use first 2)
        posAttr.setXYZ(0, positions[0], positions[1], positions[2]);
        posAttr.setXYZ(1, positions[3], positions[4], positions[5]);
        posAttr.needsUpdate = true;
        (line.material as THREE.LineBasicMaterial).color.setHex(0xaa44ff);
        (line.material as THREE.LineBasicMaterial).opacity = 0.9;
        line.visible = true;
      }
      break;
    }
    case "smoke": {
      // Grey smoke sprite drifting with wind
      item.ttl = isLow ? 0.2 : 0.8;
      flash.position.copy(pos);
      flash.scale.set(20, 20, 1);
      (flash.material as THREE.SpriteMaterial).color.setHex(0x555555);
      (flash.material as THREE.SpriteMaterial).blending = THREE.NormalBlending;
      (flash.material as THREE.SpriteMaterial).opacity = 0.5;
      flash.visible = true;
      for (const line of item.lines) line.visible = false;
      break;
    }
    case "directional": {
      // Cone in direction of incoming fire
      item.ttl = isLow ? 0.1 : 0.25;
      const dir = surfaceNormal ?? new THREE.Vector3(0, 1, 0);
      flash.position.copy(pos).add(dir.clone().multiplyScalar(5));
      flash.scale.set(25, 25, 1);
      (flash.material as THREE.SpriteMaterial).color.setHex(0xff8844);
      (flash.material as THREE.SpriteMaterial).opacity = 0.9;
      flash.visible = true;
      for (const line of item.lines) {
        const spread = new THREE.Vector3(
          dir.x + (Math.random() - 0.5) * 0.6,
          dir.y + (Math.random() - 0.5) * 0.6,
          dir.z + (Math.random() - 0.5) * 0.6,
        ).normalize();
        const len = 8 + Math.random() * 8;
        const p = line.geometry.attributes.position as THREE.BufferAttribute;
        p.setXYZ(0, pos.x, pos.y, pos.z);
        p.setXYZ(1, pos.x + spread.x * len, pos.y + spread.y * len, pos.z + spread.z * len);
        p.needsUpdate = true;
        (line.material as THREE.LineBasicMaterial).color.setHex(0xff8844);
        (line.material as THREE.LineBasicMaterial).opacity = 0.8;
        line.visible = true;
      }
      break;
    }
  }
}

/**
 * W1.1 — Shockwave ring expanding from pos. Used by Area archetype.
 * Ring expands radius → maxRadius over 0.5s, fades out.
 */
export function spawnShockwave(
  ctx: SceneContext,
  pos: THREE.Vector3,
  maxRadius: number = 60,
): void {
  const pool = ctx.weaponPool;
  if (!pool) return;
  const isLow = ctx.settings.preset === "LOW";
  if (isLow) {
    // LOW: just a flash
    const item = acquireImpact(pool);
    if (!item) return;
    item.pos.copy(pos);
    item.t = 0;
    item.ttl = 0.15;
    item.kind = "sparks";
    item.active = true;
    const flash = item.sprites[0];
    flash.position.copy(pos);
    flash.scale.set(maxRadius * 0.5, maxRadius * 0.5, 1);
    (flash.material as THREE.SpriteMaterial).color.setHex(0xffffff);
    (flash.material as THREE.SpriteMaterial).opacity = 0.9;
    flash.visible = true;
    for (const line of item.lines) line.visible = false;
    return;
  }

  // HIGH+: actual shockwave ring
  const item = acquireImpact(pool);
  if (!item) return;
  item.pos.copy(pos);
  item.t = 0;
  item.ttl = 0.5;
  item.kind = "directional";
  item.active = true;

  const flash = item.sprites[0];
  flash.position.copy(pos);
  flash.scale.set(maxRadius * 0.3, maxRadius * 0.3, 1);
  (flash.material as THREE.SpriteMaterial).color.setHex(0xffffff);
  (flash.material as THREE.SpriteMaterial).opacity = 0.95;
  flash.visible = true;

  // Use line as ring indicator (approximate)
  for (const line of item.lines) {
    const p = line.geometry.attributes.position as THREE.BufferAttribute;
    p.setXYZ(0, pos.x - maxRadius * 0.3, pos.y, pos.z);
    p.setXYZ(1, pos.x + maxRadius * 0.3, pos.y, pos.z);
    p.needsUpdate = true;
    (line.material as THREE.LineBasicMaterial).color.setHex(0xffffff);
    (line.material as THREE.LineBasicMaterial).opacity = 0.7;
    line.visible = true;
  }
}

// ─── Tick (per frame, dt fixed 1/60) ──────────────────────────────

/**
 * Update all active weapon effects. Call per frame from render loop.
 * Budget target: ≤0.8ms/frame at HIGH with full duel scene.
 */
export function tickWeapons(ctx: SceneContext, dt: number): void {
  const pool = ctx.weaponPool;
  if (!pool) return;

  // ── Tracers ──
  for (const item of pool.tracers) {
    if (!item.active) continue;
    item.t += dt;
    if (item.t >= item.ttl) {
      item.active = false;
      item.line.visible = false;
      (item.line.material as THREE.LineBasicMaterial).opacity = 0;
      continue;
    }
    // Advance tracer from→to at speed
    const progress = Math.min(1, (item.t * item.speed) / item.from.distanceTo(item.to));
    const head = item.from.clone().lerp(item.to, progress);
    const tailLen = 8 / item.speed * item.from.distanceTo(item.to);
    const tailProgress = Math.max(0, progress - tailLen);
    const tail = item.from.clone().lerp(item.to, tailProgress);

    const pos = item.line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, tail.x, tail.y, tail.z);
    pos.setXYZ(1, head.x, head.y, head.z);
    pos.needsUpdate = true;

    // Fade in first 10%, fade out last 20%
    const fade = item.t < 0.03 ? item.t / 0.03 : item.t > item.ttl * 0.8 ? 1 - (item.t - item.ttl * 0.8) / (item.ttl * 0.2) : 1;
    (item.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, Math.min(1, fade));
    item.line.visible = fade > 0.01;
  }

  // ── Beams ──
  for (const item of pool.beams) {
    if (!item.active) continue;
    item.t += dt;
    if (item.t >= item.ttl) {
      item.active = false;
      item.mesh.visible = false;
      item.glow.visible = false;
      (item.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
      (item.glow.material as THREE.SpriteMaterial).opacity = 0;
      continue;
    }

    if (item.t < 0) {
      // Telegraph phase: glow charges up at source
      const telegraphProgress = (item.t + 0.2) / 0.2; // 0→1 over 200ms
      (item.glow.material as THREE.SpriteMaterial).opacity = telegraphProgress * 0.7;
      const glowScale = 8 + telegraphProgress * 16;
      item.glow.scale.set(glowScale, glowScale, 1);
      item.mesh.visible = false;
    } else {
      // Active beam phase
      item.mesh.visible = true;
      item.glow.visible = true;

      // Orient beam from→to
      _mid.addVectors(item.from, item.to).multiplyScalar(0.5);
      item.mesh.position.copy(_mid);
      item.mesh.lookAt(item.to);

      const beamLen = item.from.distanceTo(item.to);
      item.mesh.scale.set(beamLen, 2 + item.heat * 4, 1);

      // Shimmer: oscillate opacity + slight scale wobble
      const shimmer = 0.7 + Math.sin(item.t * 40) * 0.15 + Math.sin(item.t * 67) * 0.1;
      (item.mesh.material as THREE.MeshBasicMaterial).opacity = shimmer * 0.85;

      // Glow at source (hot point)
      item.glow.position.copy(item.from);
      const glowSize = 10 + item.heat * 15;
      item.glow.scale.set(glowSize, glowSize, 1);
      (item.glow.material as THREE.SpriteMaterial).opacity = 0.6 + shimmer * 0.3;

      // Fade out in last 20%
      if (item.t > item.ttl * 0.8) {
        const fadeOut = 1 - (item.t - item.ttl * 0.8) / (item.ttl * 0.2);
        (item.mesh.material as THREE.MeshBasicMaterial).opacity *= fadeOut;
        (item.glow.material as THREE.SpriteMaterial).opacity *= fadeOut;
      }
    }
  }

  // ── Missiles ──
  for (const item of pool.missiles) {
    if (!item.active) continue;
    item.t += dt;
    if (item.t >= item.ttl) {
      item.active = false;
      item.body.visible = false;
      item.glow.visible = false;
      item.trail.visible = false;
      continue;
    }

    // Move in direction
    item.pos.addScaledVector(item.dir, item.speed * dt);

    // Slight spiral (asap trail pattern)
    const spiral = Math.sin(item.t * 8) * 0.02;
    item.dir.x += Math.cos(item.t * 12) * spiral;
    item.dir.z += Math.sin(item.t * 12) * spiral;
    item.dir.normalize();

    item.body.position.copy(item.pos);
    item.body.lookAt(item.pos.clone().add(item.dir));

    // Engine glow behind body
    item.glow.position.copy(item.pos).addScaledVector(item.dir, -4);
    (item.glow.material as THREE.SpriteMaterial).opacity = 0.8 + Math.sin(item.t * 20) * 0.15;

    // Update trail (prepend position, max 60 points)
    item.trailPoints.unshift(item.pos.clone());
    if (item.trailPoints.length > 60) item.trailPoints.length = 60;
    const trailPos = item.trail.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 60; i++) {
      const p = item.trailPoints[Math.min(i, item.trailPoints.length - 1)];
      trailPos.setXYZ(i, p.x, p.y, p.z);
    }
    trailPos.needsUpdate = true;

    // Trail opacity fades toward end
    const trailFade = item.t > item.ttl * 0.7 ? 1 - (item.t - item.ttl * 0.7) / (item.ttl * 0.3) : 0.4;
    (item.trail.material as THREE.LineBasicMaterial).opacity = Math.max(0, trailFade);
  }

  // ── Impacts ──
  for (const item of pool.impacts) {
    if (!item.active) continue;
    item.t += dt;
    if (item.t >= item.ttl) {
      item.active = false;
      for (const s of item.sprites) { s.visible = false; (s.material as THREE.SpriteMaterial).opacity = 0; }
      for (const l of item.lines) { l.visible = false; (l.material as THREE.LineBasicMaterial).opacity = 0; }
      // Reset blending for smoke kind (in case it was changed)
      if (item.kind === "smoke") {
        (item.sprites[0].material as THREE.SpriteMaterial).blending = THREE.AdditiveBlending;
      }
      continue;
    }

    const progress = item.t / item.ttl;
    const fade = item.kind === "smoke"
      ? Math.min(1, item.t * 3) * (1 - progress * 0.6) // smoke lingers
      : 1 - progress; // everything else fades linearly

    const flash = item.sprites[0];
    if (flash.visible) {
      (flash.material as THREE.SpriteMaterial).opacity = Math.max(0, fade * 0.9);
      // Expand smoke
      if (item.kind === "smoke") {
        const s = 20 + item.t * 30;
        flash.scale.set(s, s, 1);
        flash.position.y += dt * 3; // drift up
      }
    }
    for (const line of item.lines) {
      if (line.visible) {
        (line.material as THREE.LineBasicMaterial).opacity = Math.max(0, fade * 0.8);
      }
    }
  }
}

// ─── Dispose ───────────────────────────────────────────────────────

export function disposeWeaponPool(pool: WeaponPool): void {
  for (const t of pool.tracers) {
    t.line.geometry.dispose();
    (t.line.material as THREE.Material).dispose();
  }
  for (const b of pool.beams) {
    b.mesh.geometry.dispose();
    (b.mesh.material as THREE.Material).dispose();
    (b.glow.material as THREE.Material).dispose();
  }
  for (const m of pool.missiles) {
    m.body.geometry.dispose();
    (m.body.material as THREE.Material).dispose();
    (m.glow.material as THREE.Material).dispose();
    m.trail.geometry.dispose();
    (m.trail.material as THREE.Material).dispose();
  }
  for (const im of pool.impacts) {
    for (const s of im.sprites) {
      (s.material as THREE.Material).dispose();
    }
    for (const l of im.lines) {
      l.geometry.dispose();
      (l.material as THREE.Material).dispose();
    }
  }
}
