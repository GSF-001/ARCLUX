// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/camera.ts — kamera pilot, 4 mode §21 (free/follow/tactical/cinematic).
// Moved verbatim dari scene3d.ts — state (camMode/look) tinggal di ctx.

import * as THREE from "three";
import type { SceneContext } from "./bootstrap";
import { clampLocal } from "./vessels";

export type CameraMode = "free" | "follow" | "tactical" | "cinematic";

/** Perspektif pilot — posisi awal sama kayak file lama. */
export function createCamera(width: number, height: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, width / height, 1, 1_000_000);
  camera.position.set(0, 1600, 6400);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function setCameraMode(ctx: SceneContext, mode: CameraMode): void {
  ctx.camMode = mode;
}

export function setLookYawPitch(ctx: SceneContext, yaw: number, pitch: number): void {
  ctx.lookYaw = yaw;
  ctx.lookPitch = Math.max(-1.2, Math.min(1.2, pitch));
}

/** Update kamera per frame — cinematic/tactical absolut, follow/free relatif anchor. */
export function updateCamera(ctx: SceneContext, t: number): void {
  const camera = ctx.camera;
  if (!camera) return;
  const target = ctx.firstVesselRef;
  const p = new THREE.Vector3(0, 0, 0);
  if (target) p.copy(clampLocal(new THREE.Vector3(target.position.x, target.position.y, target.position.z), ctx.anchor));
  const d = 0.06;
  if (ctx.camMode === "cinematic") {
    // §21 cinematic — sweeping, dramatic angle, membidik system.
    const r = 4200 + Math.sin(t * 0.00002) * 1400;
    camera.position.x = Math.sin(t * 0.00012) * r;
    camera.position.z = Math.cos(t * 0.00012) * r;
    camera.position.y = 2400 + Math.sin(t * 0.00006) * 600;
    camera.lookAt(0, 0, 0);
    return;
  }
  if (ctx.camMode === "tactical") {
    // §21 tactical — overview battlefield dari atas.
    const r = 1600;
    camera.position.x = p.x + Math.sin(t * 0.00004) * r;
    camera.position.z = p.z + Math.cos(t * 0.00004) * r;
    camera.position.y = p.y + 2600;
    camera.lookAt(p.x, p.y, p.z);
    return;
  }
  // follow & free: pilot perspective
  if (ctx.camMode === "follow" && target) {
    const yaw = target.heading.yaw + ctx.lookYaw;
    const pitch = ctx.lookPitch;
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
    const yaw = ctx.lookYaw, pitch = ctx.lookPitch;
    const radius = 5200;
    camera.position.x = p.x + radius * Math.sin(yaw) * Math.cos(pitch);
    camera.position.y = p.y + radius * Math.sin(pitch);
    camera.position.z = p.z + radius * Math.cos(yaw) * Math.cos(pitch);
    camera.lookAt(p.x, p.y, p.z);
  }
}

// ---------------------------------------------------------------------------
// R1.5 — Transisi orbit↔surface visual effects (DOM overlay, ~0 cost)
// ---------------------------------------------------------------------------

export type TransitionKind = "gatelink" | "atmosphere_entry" | "dock_iris";

export interface TransitionState {
  active: boolean;
  kind: TransitionKind;
  startMs: number;
  overlay: HTMLElement | null;
}

const TRANSITION_MS: Record<TransitionKind, number> = {
  gatelink: 500,
  atmosphere_entry: 600,
  dock_iris: 300,
};

export function createTransitionState(): TransitionState {
  return { active: false, kind: "gatelink", startMs: 0, overlay: null };
}

/**
 * R1.5 — Trigger transition overlay. DOM-based (cheap):
 * - gatelink: white flash + streak lines
 * - atmosphere_entry: orange heat glow + shake
 * - dock_iris: circle iris wipe (CSS clip-path)
 */
export function triggerTransition(state: TransitionState, kind: TransitionKind): void {
  state.active = true;
  state.kind = kind;
  state.startMs = performance.now();

  let el = state.overlay;
  if (!el) {
    if (typeof document === "undefined") return;
    el = document.createElement("div");
    el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:0;transition:opacity 0.15s;";
    document.body.appendChild(el);
    state.overlay = el;
  }

  if (kind === "gatelink") {
    el.style.background = "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(80,180,255,0.3) 60%, transparent 100%)";
    el.style.clipPath = "none";
  } else if (kind === "atmosphere_entry") {
    el.style.background = "radial-gradient(circle, rgba(255,100,30,0.7) 0%, rgba(255,50,10,0.3) 60%, transparent 100%)";
    el.style.clipPath = "none";
  } else {
    el.style.background = "#000";
    el.style.clipPath = "circle(0% at 50% 50%)";
  }
  el.style.opacity = "1";
}

/** R1.5 — Per-frame tick for transitions. Call from frame loop. */
export function tickTransition(state: TransitionState): void {
  if (!state.active || !state.overlay) return;
  const elapsed = performance.now() - state.startMs;
  const duration = TRANSITION_MS[state.kind];
  const t = Math.min(1, elapsed / duration);

  if (t < 0.4) {
    state.overlay.style.opacity = String(Math.min(1, t / 0.3));
  } else if (state.kind === "dock_iris") {
    // Iris wipe: clip-path circle grows then shrinks
    const irisT = t < 0.5 ? t / 0.5 : 2 - t / 0.5;
    state.overlay.style.clipPath = `circle(${irisT * 70}% at 50% 50%)`;
    state.overlay.style.opacity = "1";
  } else {
    state.overlay.style.opacity = String(Math.max(0, 1 - (t - 0.4) / 0.6));
  }

  if (t >= 1) {
    state.active = false;
    state.overlay.style.opacity = "0";
    state.overlay.style.clipPath = "none";
  }
}

export function disposeTransition(state: TransitionState): void {
  if (state.overlay && typeof state.overlay.remove === "function") {
    state.overlay.remove();
  }
  state.overlay = null;
}
