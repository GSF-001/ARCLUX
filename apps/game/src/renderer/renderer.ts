// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// src/renderer/renderer.ts — bootstrap renderer (three scene) di browser context.

import { initScene3D, type Scene3D } from "./scene3d";
import { connectNet, type NetHandle } from "./net";

export interface RendererHandle {
  scene: Scene3D;
  net: NetHandle;
  dispose(): void;
}

export function bootstrapRenderer(): RendererHandle {
  const scene = initScene3D();
  const net = connectNet();

  // Wire snapshot → scene (server-authoritative, D-008)
  const stop = net.onState((region) => {
    // RegionSnapshot (from HTTP) is { regionId, tick, entities: [] } — adapt to RegionState shape for scene
    const adapted: any = {
      regionId: (region as any).regionId,
      tick: (region as any).tick,
      entities: new Map((region as any).entities?.map?.((e: any) => [e.id, e]) ?? []),
    };
    scene.renderRegion(adapted);
  });

  const dispose = () => { stop(); scene.dispose(); };

  // Expose for manual control in devtools
  if (typeof window !== "undefined") (window as any).__arcluxRenderer = { scene, net };

  return { scene, net, dispose };
}

if (typeof document !== "undefined") {
  bootstrapRenderer();
}
