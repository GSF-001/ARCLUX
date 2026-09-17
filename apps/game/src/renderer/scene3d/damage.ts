// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/damage.ts — 10.V D1 damage visual mapping.
// D1.1: DamageVisualState + resolveDamageVisuals (pure, testable).
// D1.2: applyDamageVisuals (material swap, cached refs, no traverse/frame).
// D1.3: Smoke + fire sprites (reuse weapons.ts pool, wind advect).
// D1.4: Deformation — DISABLED skew/hide mesh, scar decals.
// D1.5: HUD subsystem bars (exported level data for DOM consumption).
//
// Otoritas nol: semua baca SystemState.health dari sim, tidak pernah menulis.

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import type { SystemState } from "../../../../../packages/universe/types";
import type { SceneContext } from "./bootstrap";
import { makeGlowTexture } from "./bootstrap";

// ─── D1.1: Damage levels + resolver ────────────────────────────────

export type DamageLevel = "OK" | "DAMAGED" | "DISABLED" | "DEPLETED";

export interface SubsystemDamage {
  level: DamageLevel;
  health: number; // raw 0..100
}

export interface DamageVisualState {
  engine: SubsystemDamage;
  navigation: SubsystemDamage;
  weapons: SubsystemDamage;
  defense: SubsystemDamage;
  reactor: SubsystemDamage;
}

/** Thresholds §11: OK >60, DAMAGED 25–60, DISABLED <25, DEPLETED =0. */
function healthToLevel(health: number, isReactor = false): DamageLevel {
  if (health <= 0 && isReactor) return "DEPLETED";
  if (health <= 0) return "DISABLED";
  if (health < 25) return "DISABLED";
  if (health < 60) return "DAMAGED";
  return "OK";
}

/**
 * D1.1 — Pure function: health array → DamageVisualState.
 * Testable without THREE. Read-only (never mutates input).
 */
export function resolveDamageVisuals(systems: SystemState[]): DamageVisualState {
  const find = (id: string) => systems.find((s) => s.id === id)?.health ?? 100;
  return {
    engine: { level: healthToLevel(find("engine")), health: find("engine") },
    navigation: { level: healthToLevel(find("navigation")), health: find("navigation") },
    weapons: { level: healthToLevel(find("weapons")), health: find("weapons") },
    defense: { level: healthToLevel(find("defense")), health: find("defense") },
    reactor: { level: healthToLevel(find("reactor"), true), health: find("reactor") },
  };
}

// ─── D1.2: Apply to vessel group (cached material refs) ────────────

/** Cached material refs from buildVessel (M1.2 userData.mats). */
interface VesselMats {
  hullMat: THREE.MeshStandardMaterial;
  hullHighMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  cockpitMat: THREE.MeshPhysicalMaterial;
  engineMetalMat: THREE.MeshStandardMaterial;
}

/** Previous levels — only apply when level CHANGES (event, not per-frame). */
export interface DamageApplyState {
  prev: DamageVisualState;
  /** Fire/smoke sprite slots (reused per vessel). */
  fireSprites: THREE.Sprite[];
  smokeSprites: THREE.Sprite[];
  /** Scar decals (1–3 per vessel). */
  scars: THREE.Mesh[];
}

/** Create empty apply state. */
export function createDamageApplyState(): DamageApplyState {
  return {
    prev: {
      engine: { level: "OK", health: 100 },
      navigation: { level: "OK", health: 100 },
      weapons: { level: "OK", health: 100 },
      defense: { level: "OK", health: 100 },
      reactor: { level: "OK", health: 100 },
    },
    fireSprites: [],
    smokeSprites: [],
    scars: [],
  };
}

/**
 * D1.2 — Apply damage visuals to vessel group.
 * Called ONLY when level changes (event-driven, not per-frame).
 * Budget: ≤0.2ms flicker + material tint. LOW: tint only.
 */
export function applyDamageVisuals(
  ctx: SceneContext,
  group: THREE.Group,
  state: DamageVisualState,
  applyState: DamageApplyState,
): void {
  const mats = group.userData.mats as VesselMats | undefined;
  if (!mats) return;
  const isLow = ctx.settings.preset === "LOW";
  const scene = ctx.scene;

  // ── ENGINE ──
  if (state.engine.level !== applyState.prev.engine.level) {
    const lvl = state.engine.level;
    // Engine glow: OK=normal, DAMAGED=flicker dim, DISABLED=off
    mats.engineMetalMat.emissiveIntensity = lvl === "OK" ? 0.55 : lvl === "DAMAGED" ? 0.2 : 0;
    // Smoke at engine exhaust (if DAMAGED/DISABLED, not LOW)
    if (!isLow && (lvl === "DAMAGED" || lvl === "DISABLED")) {
      spawnEngineSmoke(ctx, group, applyState, lvl === "DISABLED" ? 3 : 1);
    } else {
      clearSprites(applyState.smokeSprites, scene);
    }
  }

  // ── WEAPONS ──
  if (state.weapons.level !== applyState.prev.weapons.level) {
    const lvl = state.weapons.level;
    // Mount tint: OK=normal, DAMAGED=dim, DISABLED=dark burnt
    const mountTint = lvl === "OK" ? 1.0 : lvl === "DAMAGED" ? 0.4 : 0.15;
    // Find mount meshes by name pattern (mountL, mountR, barrelL, barrelR)
    group.traverse((child) => {
      if (child.name.startsWith("mount") || child.name.startsWith("barrel")) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.emissive) mat.emissiveIntensity = mountTint * 0.35;
      }
    });
  }

  // ── DEFENSE ──
  if (state.defense.level !== applyState.prev.defense.level) {
    const lvl = state.defense.level;
    // Hull emissive: OK=normal, DAMAGED=flicker, DISABLED=crack pattern
    mats.hullMat.emissiveIntensity = lvl === "OK" ? 0.45 : lvl === "DAMAGED" ? 0.2 : 0.08;
    if (lvl === "DAMAGED" || lvl === "DISABLED") {
      mats.hullMat.emissive.setHex(lvl === "DAMAGED" ? 0x1a0a24 : 0x2a0a0a);
    } else {
      mats.hullMat.emissive.setHex(0x0a1424);
    }
  }

  // ── REACTOR ──
  if (state.reactor.level !== applyState.prev.reactor.level) {
    const lvl = state.reactor.level;
    // Global ship dimming: OK=normal, DAMAGED=dim, DISABLED=dark, DEPLETED=off
    const globalDim = lvl === "OK" ? 1.0 : lvl === "DAMAGED" ? 0.6 : lvl === "DISABLED" ? 0.25 : 0.05;
    mats.hullMat.emissiveIntensity = 0.45 * globalDim;
    mats.accentMat.emissiveIntensity = 0.35 * globalDim;
    mats.engineMetalMat.emissiveIntensity = 0.55 * globalDim;
  }

  // ── NAVIGATION ──
  if (state.navigation.level !== applyState.prev.navigation.level) {
    const lvl = state.navigation.level;
    // Nav blink: OK=visible, DAMAGED=flicker, DISABLED=off
    // Find nav blink sprites by userData or name
    group.traverse((child) => {
      if (child.name === "navBlink" || child.name === "navBlinkL" || child.name === "navBlinkR") {
        const sprite = child as THREE.Mesh;
        sprite.visible = lvl !== "DISABLED";
      }
    });
  }

  // ── DEFORMATION (D1.4) — DISABLED only ──
  applyDeformation(group, state, applyState);

  // Save previous
  applyState.prev = { ...state };
}

// ─── D1.3: Smoke + fire sprites ────────────────────────────────────

const _smokeUp = new THREE.Vector3();

function spawnEngineSmoke(
  ctx: SceneContext,
  group: THREE.Group,
  applyState: DamageApplyState,
  count: number,
): void {
  // Clear old
  clearSprites(applyState.smokeSprites, ctx.scene);
  clearSprites(applyState.fireSprites, ctx.scene);

  const glowTex = makeGlowTexture();

  // Smoke: grey additive sprites behind engine
  for (let i = 0; i < count; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: new THREE.Color(0x444444),
      transparent: true,
      opacity: 0.45,
      blending: THREE.NormalBlending,
      depthWrite: false,
    }));
    spr.position.copy(group.position);
    spr.position.z += 30; // behind engine
    spr.position.x += (Math.random() - 0.5) * 6;
    spr.position.y += (Math.random() - 0.5) * 6;
    spr.scale.set(14 + i * 4, 14 + i * 4, 1);
    ctx.scene.add(spr);
    applyState.smokeSprites.push(spr);
  }

  // Fire: orange additive flicker sprites
  const fireCount = Math.min(3, count);
  for (let i = 0; i < fireCount; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: new THREE.Color(0xff6a00),
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    spr.position.copy(group.position);
    spr.position.z += 28;
    spr.position.x += (Math.random() - 0.5) * 4;
    spr.position.y += (Math.random() - 0.5) * 4;
    spr.scale.set(8, 8, 1);
    ctx.scene.add(spr);
    applyState.fireSprites.push(spr);
  }
}

/**
 * D1.3 — Tick smoke/fire. Called per frame, ≤0.5ms budget.
 * Smoke drifts up (wind advect), fire flickers 8–12Hz.
 */
export function tickDamageVisuals(
  ctx: SceneContext,
  applyState: DamageApplyState,
  timeSec: number,
  windDir: number,
): void {
  const dt = 1 / 60;
  // Smoke drift up + wind
  for (const spr of applyState.smokeSprites) {
    _smokeUp.set(Math.cos(windDir) * 2, 3, Math.sin(windDir) * 2);
    spr.position.addScaledVector(_smokeUp, dt);
    // Slowly expand and fade
    const s = spr.scale.x + dt * 4;
    spr.scale.set(s, s, 1);
    (spr.material as THREE.SpriteMaterial).opacity = Math.max(0, (spr.material as THREE.SpriteMaterial).opacity - dt * 0.15);
  }
  // Fire flicker 8–12Hz using jam tick (not Date.now)
  for (const spr of applyState.fireSprites) {
    const flicker = 0.5 + Math.sin(timeSec * (8 + (spr.id % 5))) * 0.3;
    (spr.material as THREE.SpriteMaterial).opacity = flicker * 0.7;
    const s = 6 + Math.sin(timeSec * 12 + spr.id) * 2;
    spr.scale.set(s, s, 1);
  }
}

function clearSprites(sprites: THREE.Sprite[], scene: THREE.Scene): void {
  for (const s of sprites) {
    if (s.parent) scene.remove(s);
    (s.material as THREE.Material).dispose();
  }
  sprites.length = 0;
}

// ─── D1.4: Deformation + scar decals ───────────────────────────────

const _deformVec = new THREE.Vector3();

/**
 * D1.4 — DISABLED = skew nacelle 3–5° + hide 1 panel.
 * Scar = dark patch decal (plane + MultiplyBlending).
 * One-time per level change, NOT per frame.
 */
function applyDeformation(
  group: THREE.Group,
  state: DamageVisualState,
  applyState: DamageApplyState,
): void {
  // Engine DISABLED: skew nacelle meshes
  if (state.engine.level === "DISABLED" && applyState.prev.engine.level !== "DISABLED") {
    group.traverse((child) => {
      if (child.name === "nacL" || child.name === "nacR") {
        const mesh = child as THREE.Mesh;
        const skew = child.name === "nacL" ? 0.07 : -0.07; // 3–5°
        mesh.rotation.z += skew;
      }
    });
  }

  // Weapons DISABLED: hide one barrel
  if (state.weapons.level === "DISABLED" && applyState.prev.weapons.level !== "DISABLED") {
    group.traverse((child) => {
      if (child.name === "barrelR") {
        child.visible = false;
      }
    });
  }

  // Scar decals: add 1–3 dark patches at random hull positions
  if ((state.defense.level === "DAMAGED" || state.defense.level === "DISABLED") &&
      applyState.scars.length === 0) {
    const scarCount = state.defense.level === "DISABLED" ? 3 : 1;
    for (let i = 0; i < scarCount; i++) {
      const geo = new THREE.PlaneGeometry(4 + Math.random() * 6, 3 + Math.random() * 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x1a0a0a,
        transparent: true,
        opacity: 0.6,
        blending: THREE.MultiplyBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const scar = new THREE.Mesh(geo, mat);
      scar.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 40,
      );
      scar.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      group.add(scar);
      applyState.scars.push(scar);
    }
  }

  // Remove scars if repaired
  if (state.defense.level === "OK" && applyState.scars.length > 0) {
    for (const scar of applyState.scars) {
      group.remove(scar);
      scar.geometry.dispose();
      (scar.material as THREE.Material).dispose();
    }
    applyState.scars.length = 0;
  }
}

// ─── D1.5: HUD subsystem level data ────────────────────────────────

/** Per-subsystem bar data for DOM HUD consumption (10Hz hash-guard). */
export interface SubsystemBarData {
  id: string;
  label: string;
  level: DamageLevel;
  health: number; // 0..100
  color: string; // CSS color for bar
  flicker: boolean; // true = DAMAGED flicker
  blink: boolean; // true = DISABLED red blink
}

const LEVEL_COLORS: Record<DamageLevel, string> = {
  OK: "#5fe0a0",
  DAMAGED: "#f5a742",
  DISABLED: "#ff5a5f",
  DEPLETED: "#aa0a0a",
};

/**
 * D1.5 — Convert DamageVisualState to HUD bar data.
 * Pure function, consumed by hud.ts at 10Hz.
 */
export function damageToHudBars(state: DamageVisualState): SubsystemBarData[] {
  return [
    { id: "engine", label: "ENGINE", level: state.engine.level, health: state.engine.health, color: LEVEL_COLORS[state.engine.level], flicker: state.engine.level === "DAMAGED", blink: state.engine.level === "DISABLED" },
    { id: "navigation", label: "NAV", level: state.navigation.level, health: state.navigation.health, color: LEVEL_COLORS[state.navigation.level], flicker: state.navigation.level === "DAMAGED", blink: state.navigation.level === "DISABLED" },
    { id: "weapons", label: "WEAPONS", level: state.weapons.level, health: state.weapons.health, color: LEVEL_COLORS[state.weapons.level], flicker: state.weapons.level === "DAMAGED", blink: state.weapons.level === "DISABLED" },
    { id: "defense", label: "DEFENSE", level: state.defense.level, health: state.defense.health, color: LEVEL_COLORS[state.defense.level], flicker: state.defense.level === "DAMAGED", blink: state.defense.level === "DISABLED" },
    { id: "reactor", label: "REACTOR", level: state.reactor.level, health: state.reactor.health, color: LEVEL_COLORS[state.reactor.level], flicker: state.reactor.level === "DAMAGED", blink: state.reactor.level === "DISABLED" },
  ];
}

// ─── Dispose ───────────────────────────────────────────────────────

export function disposeDamageApplyState(ctx: SceneContext, applyState: DamageApplyState): void {
  clearSprites(applyState.fireSprites, ctx.scene);
  clearSprites(applyState.smokeSprites, ctx.scene);
  for (const scar of applyState.scars) {
    ctx.scene.remove(scar);
    scar.geometry.dispose();
    (scar.material as THREE.Material).dispose();
  }
  applyState.scars.length = 0;
}
