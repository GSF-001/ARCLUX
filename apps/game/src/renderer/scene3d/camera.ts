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
