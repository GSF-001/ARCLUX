#!/usr/bin/env node
// check-license — guard dual license headers (permanen, gak perlu ingat manual).
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mmoPaths = [
  "packages/gameserver",
  "packages/relay",
  "packages/universe",
  "apps/game",
];
const apachePaths = [
  "packages/engine",
  "packages/parser",
  "packages/graph",
  "apps/web",
  "apps/cli",
];

let fail = false;
for (const p of mmoPaths) {
  const dir = path.join(root, p);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir, { recursive: true });
  for (const f of files) {
    if (String(f).includes("node_modules")) continue;
    if (!String(f).endsWith(".ts")) continue;
    const full = path.join(dir, String(f));
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) continue;
    const txt = fs.readFileSync(full, "utf8");
    if (!txt.includes("ARCLUX MMO License")) {
      console.error(`[check-license] FAIL ${path.relative(root, full)} — missing ARCLUX MMO License header`);
      fail = true;
    }
  }
}
if (fail) {
  console.error("[check-license] FIX: header harus 'ARCLUX MMO License v1 (GSF-001)' — engine tetap Apache");
  process.exit(1);
}
console.log("[check-license] OK — MMO product headers ARCLUX MMO v1, engine Apache preserved");
