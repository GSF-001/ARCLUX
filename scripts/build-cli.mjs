#!/usr/bin/env node
// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Bundles the arclux CLI into ONE self-contained file (dist/arclux.mjs)
// and ships the tree-sitter grammars next to it (dist/../wasms/). The
// loader in packages/parser/core/treeSitterLoader.ts finds them via the
// `wasms/` sibling directory when running from the published package —
// users never install grammar packages themselves.
//
// Why esbuild and not tsc: the CLI imports live from ../../packages/*
// (monorepo sources, not registry deps). Bundling inlines all 40+
// packages into one file that `npx arclux` can run with zero setup.
// Native deps (web-tree-sitter) stay external — they're regular npm
// dependencies of the published package.

import { cpSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "apps", "cli", "dist");
const wasmOut = path.join(outDir, "..", "wasms");

// esbuild lives in apps/web's dependency slice (hoisted into .pnpm, not
// necessarily the root node_modules). Try the import name, then .pnpm.
const __req = createRequire(import.meta.url);
let esbuildPkg;
try {
  esbuildPkg = __req("esbuild");
} catch {
  const pnpmDir = path.join(root, "node_modules", ".pnpm");
  const esbuildDir = readdirSync(pnpmDir)
    .filter((d) => d.startsWith("esbuild@"))
    .sort()
    .pop();
  esbuildPkg = __req(path.join(pnpmDir, esbuildDir, "node_modules", "esbuild"));
}
const { build } = esbuildPkg;

mkdirSync(outDir, { recursive: true });
mkdirSync(wasmOut, { recursive: true });

const external = [
  // Real runtime deps — installed with the package, not bundled.
  "commander",
  "@clack/prompts",
  "web-tree-sitter",
  "@modelcontextprotocol/sdk",
  // Node builtins are always external.
  "node:*",
  "fs",
  "path",
  "os",
  "child_process",
  "node:fs/promises",
];

await build({
  entryPoints: [path.join(root, "apps", "cli", "index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: path.join(outDir, "arclux.mjs"),
  external,
  banner: {
    // ESM needs dirname/relative-import shims for import.meta users.
    js: "import { createRequire as __cr } from 'node:module'; import { fileURLToPath as __fup } from 'node:url'; import __path from 'node:path'; const require = __cr(import.meta.url); const __filename = __fup(import.meta.url); const __dirname = __path.dirname(__filename);",
  },
  sourcemap: false,
  minify: false,
  logLevel: "info",
});

// Library bundle — the `arclux` package as an embeddable import.
await build({
  entryPoints: [path.join(root, "apps", "cli", "lib.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: path.join(outDir, "arclux-lib.mjs"),
  external,
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; import { fileURLToPath as __fup } from 'node:url'; import __path from 'node:path'; const require = __cr(import.meta.url); const __filename = __fup(import.meta.url); const __dirname = __path.dirname(__filename);",
  },
  sourcemap: false,
  minify: false,
  logLevel: "info",
});

// TypeScript declarations for the library. The lib bundle is ONE module
// (esbuild inline), but consumers need typed exports — tsc emits a
// per-source .d.ts tree from lib.ts that mirrors the public API. We ship
// it layered under dist/ so `exports["."].types` resolves. tsc lives in
// the root node_modules.
const tscPath = __req.resolve("typescript/bin/tsc");
const declDir = path.join(outDir, "decl");
rmSync(declDir, { recursive: true, force: true });
const declCmd = [
  process.execPath,
  tscPath,
  path.join(root, "apps", "cli", "lib.ts"),
  "--declaration", "--emitDeclarationOnly",
  "--outDir", declDir,
  "--rootDir", root,
  "--module", "esnext",
  "--moduleResolution", "bundler",
  "--target", "es2022",
  "--lib", "ES2022",
  "--skipLibCheck", "--strict", "--esModuleInterop",
  "--allowImportingTsExtensions", "--types", "node",
];
await new Promise((resolve, reject) => {
  const { spawn } = __req("node:child_process");
  const child = spawn(declCmd[0], declCmd.slice(1), { stdio: "inherit" });
  child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tsc declaration emit failed (exit ${code})`))));
  child.on("error", reject);
});
// Lay the emitted tree into dist/ (lib.d.ts + dist/packages/*.d.ts).
const libDts = path.join(declDir, "apps", "cli", "lib.d.ts");
cpSync(libDts, path.join(outDir, "apps", "cli", "lib.d.ts"), { recursive: true });
cpSync(path.join(declDir, "packages"), path.join(outDir, "packages"), { recursive: true });
rmSync(declDir, { recursive: true, force: true });

// Ship grammars: vendored overrides first (elm ABI fix), then fill any
// gaps from tree-sitter-wasms/out.
const vendoredDir = path.join(root, "packages", "parser", "wasms");
const npmWasms = path.join(root, "node_modules", "tree-sitter-wasms", "out");

let shipped = 0;
for (const src of [vendoredDir, npmWasms]) {
  if (!existsSync(src)) continue;
  for (const f of readdirSync(src)) {
    if (!f.endsWith(".wasm")) continue;
    const dest = path.join(wasmOut, f);
    if (existsSync(dest)) continue; // vendored wins
    cpSync(path.join(src, f), dest);
    shipped++;
  }
}

console.log(`\n✓ bundled apps/cli/dist/arclux.mjs`);
console.log(`✓ bundled apps/cli/dist/arclux-lib.mjs (programmatic API)`);
console.log(`✓ ${shipped} grammars shipped to apps/cli/wasms/`);
console.log(`  (wasms live as dist's sibling — the loader finds them there)`);
