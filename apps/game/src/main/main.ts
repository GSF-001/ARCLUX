// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/main/main.ts — Electron main process (jendela + lifecycle + IPC bridge).

export interface MainHandle {
  window: unknown;
}

export function startMain(): MainHandle {
  // Lazy import electron — only available in Electron runtime, not in web/Node tests
  let win: unknown = null;
  try {
    const electron: any = (() => { try { return require("electron"); } catch { return null; } })();
    if (electron?.app && electron?.BrowserWindow) {
      const createWindow = () => {
        win = new electron.BrowserWindow({
          width: 1280,
          height: 800,
          webPreferences: { contextIsolation: true, nodeIntegration: false, preload: __dirname + "/preload.js" },
        });
        (win as any).loadFile("index.html").catch(() => (win as any).loadURL("http://localhost:3000"));
      };
      electron.app.whenReady().then(createWindow);
      electron.app.on("window-all-closed", () => { if (process.platform !== "darwin") electron.app.quit(); });
      electron.app.on("activate", () => { if (electron.BrowserWindow.getAllWindows().length === 0) createWindow(); });
    }
  } catch {}
  return { window: win };
}
