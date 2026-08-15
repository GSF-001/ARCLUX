// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Validates AGENT_DIARY.md structure — catches the P-003 failure class:
// an edit_file that REPLACES an entry's header instead of inserting before
// it leaves the entry body orphaned under the previous entry (a
// "**Status:**" line with no "## " header of its own nearby).
//
// Rule: every "**Status:**" line must sit within 2 lines of a "## " header
// (header [+ blank] + Status). Run after any AGENT_DIARY.md edit:
//
//   npx tsx scripts/check-diary.ts
//
// Exit 1 with the offending lines if the diary structure is broken.

import { readFileSync } from "node:fs";
import path from "node:path";

const diaryPath = path.resolve(process.cwd(), "AGENT_DIARY.md");
const lines = readFileSync(diaryPath, "utf8").split("\n");

let lastHeaderLine = -1;
let lastHeaderText = "";
const orphans: string[] = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith("## ")) {
    lastHeaderLine = i;
    lastHeaderText = line;
    continue;
  }
  if (line.startsWith("**Status:**")) {
    const gap = lastHeaderLine === -1 ? Number.POSITIVE_INFINITY : i - lastHeaderLine;
    if (gap > 2) {
      orphans.push(
        `L${i + 1}: "${line.slice(0, 40)}..." — no "## " header within 2 lines (last header: L${lastHeaderLine + 1} "${lastHeaderText.slice(0, 50)}")`
      );
    }
  }
}

if (orphans.length > 0) {
  console.error(
    `AGENT_DIARY.md structure broken — ${orphans.length} orphaned entry bod(y/ies) (P-003):`
  );
  for (const o of orphans) console.error(`  - ${o}`);
  process.exit(1);
}

console.log("AGENT_DIARY.md: OK — every **Status:** has a recent ## header");
