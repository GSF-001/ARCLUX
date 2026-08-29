// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// src/renderer/scene3d.ts — 3D vessel render dari RegionState (client-side only).
//
// 🚧 SCAFFOLD. TODO implementasi di §TODOS.
//
// Prinsip (blueprint 06 §18, invariant I-1): server tentukan posisi/heading/
// damage; client cuma render mesh/materi/camera. JANGAN hitung physics di sini.

import type { RegionState, VesselEntity } from "../../../../packages/gameserver/types";

export interface Scene3D {
  /** render satu snapshot region ke kanvas (panggil tiap event/state dari server). */
  renderRegion(region: RegionState): void;
  /** posisikan satu vessel menurut koordinat authoritative server. */
  updateVessel(v: VesselEntity): void;
}

/**
 * 🚧 Buat scene three.js. Belum nge-render — itulah TODO utama.
 */
export function initScene3D(): Scene3D {
  // TODO(scene3d)[init]    WebGLRenderer + PerspectiveCamera + Scene (three)
  // TODO(scene3d)[mesh]    vessel mesh dari VesselModel identity (blueprint 06 §18.3)
  // TODO(scene3d)[render]  renderRegion: iterate entities → posisikan mesh
  // TODO(scene3d)[damage]  subsystem state → visual state (non-authoritative)
  // TODO(scene3d)[gate]    visual gate/jump-gate antar region (01-spatial-ux.md)
  throw new Error("not implemented (scaffold)");
}
