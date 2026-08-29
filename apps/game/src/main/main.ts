// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// src/main/main.ts — Electron main process (jendela + lifecycle + IPC bridge).
//
// 🚧 SCAFFOLD. TODO implementasi di §TODOS.

export interface MainHandle {
  window: unknown; // BrowserWindow
}

/**
 * 🚧 Start jendela Electron utama.
 */
export function startMain(): MainHandle {
  // TODO(main)[bootstrap]  app.whenReady → new BrowserWindow (load renderer/index.html)
  // TODO(main)[ipc]        bridge: renderer intent → relay/gameserver; events → renderer
  // TODO(main)[scaff]      security: contextIsolation + nodeIntegration=false
  //
  // Impor Electron hanya di main process (node runtime) — bukan di renderer.
  throw new Error("not implemented (scaffold)");
}
