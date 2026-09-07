#!/usr/bin/env node
// check-license — guard dual license headers (permanen, gak perlu ingat manual).
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mmoPaths = [
  "packages/gameserver",
  "packages/relay",
  "packages/universe",
  "packages/directory",
  "apps/game",
];
const apachePaths = [
  "packages/engine",
  "packages/parser",
  "packages/graph",
  "packages/db",
  "packages/cache",
  "packages/indexer",
  "packages/search",
  "packages/mcp",
  "apps/web",
  "apps/cli",
  "packages/environment",
];

let fail = false;
const SKIP_PATTERNS = ["node_modules", ".next", "dist", "build", ".turbo", "pythonHighlightQuery", "eslint.config", "postcss.config", "next-env.d.ts"];
function shouldSkip(rel) {
  return SKIP_PATTERNS.some(p => rel.includes(p));
}
function checkDir(paths, licenseKind) {
  for (const p of paths) {
    const dir = path.join(root, p);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir, { recursive: true });
    for (const f of files) {
      if (shouldSkip(String(f))) continue;
      if (!String(f).endsWith(".ts") && !String(f).endsWith(".tsx")) continue;
      const full = path.join(dir, String(f));
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) continue;
      const txt = fs.readFileSync(full, "utf8");
      const rel = path.relative(root, full);
      if (shouldSkip(rel)) continue;
      if (licenseKind === "MMO") {
        // Must start with GSF-001 and contain MMO string, must NOT be Apache Mikatoshi block
        if (!txt.startsWith("// Copyright 2026 GSF-001")) {
          console.error(`[check-license] FAIL ${rel} — MMO must start "// Copyright 2026 GSF-001"`);
          fail = true;
        }
        if (!txt.includes("ARCLUX MMO License v1 (GSF-001)")) {
          console.error(`[check-license] FAIL ${rel} — missing ARCLUX MMO License v1 (GSF-001)`);
          fail = true;
        }
        if (txt.includes("Copyright 2026 Mikatoshi") && txt.includes("http://www.apache.org/licenses/LICENSE-2.0") && txt.trimStart().startsWith("/**")) {
          console.error(`[check-license] FAIL ${rel} — MMO file pakai Apache Mikatoshi block, harus GSF-001`);
          fail = true;
        }
        // Planetary files stricter: forbid → use ->
        if (rel.includes("planetary/") && txt.includes("→")) {
          console.error(`[check-license] FAIL ${rel} — planetary forbidden "→" use "->"`);
          fail = true;
        }
      } else {
        // Apache — must NOT contain MMO; should contain Mikatoshi but warn only (many web vendor files are third-party)
        if (txt.includes("ARCLUX MMO License")) {
          console.error(`[check-license] FAIL ${rel} — Apache file pakai MMO header, harus Mikatoshi`);
          fail = true;
        }
        // For core packages, require Mikatoshi header (fail); for apps/web vendor, warn only
        const isCoreApache = rel.startsWith("packages/engine") || rel.startsWith("packages/parser") || rel.startsWith("packages/graph") || rel.startsWith("packages/environment");
        if (isCoreApache) {
          if (!txt.includes("Copyright 2026 Mikatoshi") || !txt.includes("Apache License, Version 2.0")) {
            console.error(`[check-license] FAIL ${rel} — core Apache must contain "Copyright 2026 Mikatoshi" + "Apache License, Version 2.0"`);
            fail = true;
          }
          const startsOk = txt.startsWith("// Copyright 2026 Mikatoshi") || txt.startsWith("/**\n * Copyright 2026 Mikatoshi");
          if (!startsOk) {
            console.error(`[check-license] FAIL ${rel} — core Apache must start "// Copyright 2026 Mikatoshi" or "/** * Copyright 2026 Mikatoshi"`);
            fail = true;
          }
        } else {
          // Non-core (apps/web etc) — warn only, don't fail CI for shadcn vendor
          if (!txt.includes("Copyright 2026 Mikatoshi") && !txt.includes("shadcn") && !rel.includes("vendor-ui")) {
            // silent warn for now
          }
        }
      }
    }
  }
}
checkDir(mmoPaths, "MMO");
checkDir(apachePaths, "Apache");
if (fail) {
  console.error("[check-license] FIX: MMO = // Copyright 2026 GSF-001 + ARCLUX MMO License v1 — Apache = Mikatoshi + Apache 2.0 — lihat LICENSE-MMO / LICENSE-ENGINE");
  process.exit(1);
}
console.log(`[check-license] OK — MMO ${mmoPaths.length} dirs, Apache ${apachePaths.length} dirs, no cross-contamination`);
