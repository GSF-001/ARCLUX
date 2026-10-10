#!/usr/bin/env node
// check-mmo — guard checklist gameserver vs actual files (permanen, gak perlu edit README tiap file baru).
// Sprint 4: checklist MMO-IMPLEMENTATION.md dihapus (duplikat) — satu sumber
// = docs/blueprint/progres/ue/08-server-hardening.md §4 (sprint breakdown).
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const impl = fs.readFileSync(path.join(root, "docs/blueprint/progres/ue/08-server-hardening.md"), "utf8");
const files = fs.readdirSync(path.join(root, "mmo/packages/gameserver")).filter(f => f.endsWith(".ts") && f !== "index.ts").sort();

// Extract checklist x items (markdown `- [x] ...` — termasuk multi-baris)
const checklist = [...impl.matchAll(/-\s*\[x\][^\n]*(?:\n(?!-)[^\n]*)*/g)].map(m => m[0]);
let missing = [];
for (const f of files) {
  if (!checklist.some(c => c.includes(f.replace(".ts","")))) {
    // Allow core files that are always done
    if (["types","world","validator","simulation","combat","gate","persistence","netcode","bridge"].includes(f.replace(".ts",""))) continue;
    // transport is folder
    missing.push(f);
  }
}
if (missing.length) {
  console.warn(`[check-mmo] WARNING: gameserver files not in checklist: ${missing.join(", ")} — update 08-server-hardening.md §4`);
  // Don't fail CI, just warn (permanen, gak brantakan)
} else {
  console.log("[check-mmo] OK — all gameserver files tracked in checklist");
}
console.log(`[check-mmo] gameserver files: ${files.join(", ")}`);
