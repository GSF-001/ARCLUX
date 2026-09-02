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
//   input (WASD) → intent `move` → server /intent
//   server tick → /snapshot → scene + HUD render

import { initScene3D, type Scene3D } from "./scene3d";
import { initHud, type Hud } from "./hud";
import { connectNet, type NetHandle } from "./net";
import { initInput, type InputHandle } from "./input";
import type { RegionSnapshot, VesselEntity, WorldEntity } from "../../../../packages/gameserver/types";

export interface RendererHandle {
  scene: Scene3D;
  hud: Hud;
  net: NetHandle;
  input: InputHandle;
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
  const scene = initScene3D();
  const hud = initHud();
  const net = connectNet(opts?.serverUrl);
  const input = initInput({ send: (intent) => { void net.send(intent); } });

  // Wire snapshot → scene + HUD + input (server-authoritative, D-008).
  // Server posisi = meters (skala cosmo). Renderer pakai skala stylized (scene units);
  // konversi posisi dilakukan di sini supaya renderer nggak bawa seluruh otoritas.
  const stop = net.onState((snap) => {
    const state = toRegionState(snap);
    scene.renderRegion(state);
    hud.update(state);
    // Setiap vessel dari server → input mengenali pilot local (entity pertama).
    const vessels = state.entities.values();
    for (const e of vessels) {
      if (e.kind === "vessel") { input.setLocalVessel(e as VesselEntity); break; }
    }
  });

  input.attach();

  const dispose = () => { stop(); input.detach(); scene.dispose(); hud.dispose(); };

  // Expose for manual control in devtools
  if (typeof window !== "undefined") (window as any).__arcluxRenderer = { scene, net, hud, input };

  return { scene, hud, net, input, dispose };
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