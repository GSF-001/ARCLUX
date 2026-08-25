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

import { cpSync, mkdirSync, existsSync, readdirSync } from "node:fs";
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
console.log(`✓ ${shipped} grammars shipped to apps/cli/wasms/`);
console.log(`  (wasms live as dist's sibling — the loader finds them there)`);
