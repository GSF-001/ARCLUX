#!/usr/bin/env node
// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Bundles the Electron main process for apps/game into dist/main/main.js
// (target Electron's node runtime). Renderer is bundled separately by the
// renderer toolchain / esbuild when the 3D scene is added.
//
// This is a SCAFFOLD build script — it only proves the module graph resolves;
// real packaging (electron-builder, asar, native .wasm handling) comes later.

import { mkdirSync, readdirSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "apps", "game", "dist");
const rendererOut = path.join(outDir, "renderer");

const __req = createRequire(import.meta.url);
let esbuildPkg;
try {
  esbuildPkg = __req("esbuild");
} catch {
  const pnpmDir = path.join(root, "node_modules", ".pnpm");
  if (existsSync(pnpmDir)) {
    const esbuildDir = readdirSync(pnpmDir)
      .filter((d) => d.startsWith("esbuild@"))
      .sort()
      .pop();
    esbuildPkg = __req(path.join(pnpmDir, esbuildDir, "node_modules", "esbuild"));
  }
}
const { build } = esbuildPkg;

mkdirSync(outDir, { recursive: true });
mkdirSync(path.join(outDir, "main"), { recursive: true });
mkdirSync(rendererOut, { recursive: true });

await build({
  entryPoints: [path.join(root, "apps", "game", "src", "main", "main.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: path.join(outDir, "main", "main.js"),
  external: ["electron", "node:*", "fs", "path", "os", "child_process"],
  logLevel: "info",
});

// Renderer bundle (browser ESM). `three` di-bundle (CSP default-src 'self' —
// tidak boleh CDN), menutup gap: raw `.ts` tidak bisa di-browser.
await build({
  entryPoints: [path.join(root, "apps", "game", "src", "renderer", "renderer.ts")],
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2020",
  outfile: path.join(rendererOut, "renderer.bundle.js"),
  sourcemap: true,
  logLevel: "info",
});

// index.html ikut ke dist/renderer (biar satu folder statis utuh).
copyFileSync(path.join(root, "apps", "game", "src", "renderer", "index.html"), path.join(rendererOut, "index.html"));

console.log("✓ bundled apps/game/dist/main/main.js (Electron main)");
console.log("✓ bundled apps/game/dist/renderer/ (index.html + renderer.bundle.js)");
