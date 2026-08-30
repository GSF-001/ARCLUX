// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
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
