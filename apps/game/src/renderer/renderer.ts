// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/renderer.ts — bootstrap renderer (three scene) + input + network
// di browser context. Server-authoritative: client render snapshot + kirim intent.
//
// Layering (D-008):
//   input (WASD/QE + look) → intent `move` → server /intent
//   server tick → /snapshot → scene + HUD render (+ rAF smooth interpolation)

import { initScene3D, type Scene3D } from "./scene3d";
import { initHud, type Hud } from "./hud";
import { connectNet, type NetHandle } from "./net";
import { initInput, type InputHandle } from "./input";
import { initAudio, type AudioHandle } from "./audio";
import { initMenu, type MenuHandle, type MenuCameraMode } from "./menu";
import { loadSettings } from "./settings";
import type { RegionSnapshot, VesselEntity, WorldEntity } from "../../../../packages/gameserver/types";

export interface RendererHandle {
  scene: Scene3D;
  hud: Hud;
  net: NetHandle;
  input: InputHandle;
  audio: AudioHandle;
  menu: MenuHandle;
  dispose(): void;
}

/** Adapt server `RegionSnapshot` (entities: array) → `RegionState` (Map) untuk renderer. */
function toRegionState(snap: RegionSnapshot) {
  return {
    regionId: snap.regionId,
    name: snap.name,
    tick: snap.tick,
    createdAt: snap.createdAt,
    entities: new Map<string, WorldEntity>(snap.entities.map((e: WorldEntity) => [e.id, e])),
  };
}

export function bootstrapRenderer(opts?: { serverUrl?: string }): RendererHandle {
  const settings = loadSettings();
  const scene = initScene3D(undefined, settings);
  const hud = initHud();
  const net = connectNet(opts?.serverUrl);
  const audio = initAudio();
  const input = initInput({
    send: (intent) => { void net.send(intent); },
    onLook: (yaw, pitch) => scene.setLookYawPitch(yaw, pitch),
  });
  const menu = initMenu({
    onQuality: (s) => scene.applyQuality(s),
    onAudio: (s) => audio.setEnabled(s.muted, s.masterVolume),
    onCameraMode: (mode) => scene.setCameraMode(mode as Parameters<Scene3D["setCameraMode"]>[0]),
    onSfx: (kind) => audio.ui(kind === "click" ? "click" : "hover"),
  });

  // Skena mulai dari settings tersimpan; audio unlock pertama interaksi.
  scene.applyQuality(settings);

  let lastSpeed = 0;
  const stop = net.onState((snap) => {
    const state = toRegionState(snap);
    scene.renderRegion(state);
    hud.update(state);
    // Setiap vessel dari server → input mengenali pilot local (entity pertama).
    let localVessel: VesselEntity | undefined;
    for (const e of state.entities.values()) {
      if (e.kind === "vessel") { localVessel = e as VesselEntity; break; }
    }
    input.setLocalVessel(localVessel);
    // Audio: engine hum ∝ kecepatan normalized.
    if (localVessel) {
      const v = localVessel.velocity;
      const sp = Math.min(1, Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) / 250);
      if (Math.abs(sp - lastSpeed) > 0.01) { audio.setSpeed(sp); lastSpeed = sp; }
    }
  });

  // Unlock audio + buka menu di ESC (interaction-driven, autoplay policy).
  const onDocClick = (): void => { audio.unlock(); };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Escape" && !menu.isOpen) { e.preventDefault(); menu.open(); audio.ui("click"); }
  };
  document.addEventListener("click", onDocClick, { once: true });
  window.addEventListener("keydown", onKeyDown);

  input.attach();

  const dispose = () => {
    stop();
    input.detach();
    window.removeEventListener("keydown", onKeyDown);
    scene.dispose();
    hud.dispose();
    menu.dispose();
    audio.dispose();
  };

  // Expose for manual control in devtools
  if (typeof window !== "undefined") (window as any).__arcluxRenderer = { scene, net, hud, input, audio, menu };

  return { scene, hud, net, input, audio, menu, dispose };
}

if (typeof document !== "undefined") {
  const h = bootstrapRenderer();
  // Live UI hook — expose scene/net for devtools + auto-wire tick
  let lastTick = -1;
  const poll = async () => {
    try {
      const snap: any = await h.net.fetchSnapshot();
      if (snap.tick !== lastTick) { lastTick = snap.tick; h.hud.setTick(snap.tick); }
    } catch {}
    setTimeout(poll, 100);
  };
  poll();
}