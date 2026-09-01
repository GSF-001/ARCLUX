// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/renderer.ts — bootstrap renderer (three scene) di browser context.

import { initScene3D, type Scene3D } from "./scene3d";
import { initHud, type Hud } from "./hud";
import { connectNet, type NetHandle } from "./net";

export interface RendererHandle {
  scene: Scene3D;
  hud: Hud;
  net: NetHandle;
  dispose(): void;
}

export function bootstrapRenderer(): RendererHandle {
  const scene = initScene3D();
  const hud = initHud();
  const net = connectNet();

  // Wire snapshot → scene + HUD (server-authoritative, D-008)
  const stop = net.onState((region) => {
    // RegionSnapshot (from HTTP) is { regionId, tick, entities: [] } — adapt to RegionState shape for scene
    const adapted: any = {
      regionId: (region as any).regionId,
      tick: (region as any).tick,
      entities: new Map((region as any).entities?.map?.((e: any) => [e.id, e]) ?? []),
    };
    scene.renderRegion(adapted);
    hud.update(adapted);
  });

  const dispose = () => { stop(); scene.dispose(); hud.dispose(); };

  // Expose for manual control in devtools
  if (typeof window !== "undefined") (window as any).__arcluxRenderer = { scene, net, hud };

  return { scene, hud, net, dispose };
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
