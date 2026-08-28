// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// src/renderer/renderer.ts — bootstrap renderer (three scene) di browser context.
//
// 🚧 SCAFFOLD. TODO implementasi di §TODOS.

import { initScene3D } from "./scene3d";

export function bootstrapRenderer(): void {
  // TODO(renderer)[scene]  new WebGLRenderer → append ke #app
  // TODO(renderer)[loop]    requestAnimationFrame + controls (orbit)
  // TODO(renderer)[net]     konek ke net.ts: kirim intent, terima events, update scene
  const scene = initScene3D();
  void scene;
}

// Panggil di module bootstrap (renderer tidak punya node entry).
if (typeof document !== "undefined") {
  bootstrapRenderer();
}
