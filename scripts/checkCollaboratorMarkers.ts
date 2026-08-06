// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Enforces the "mark collaborator-assigned files in-file" decision (see
// PROGRES-decisions.md). Reads every OPEN GitHub issue that has an
// assignee, extracts any repo file paths mentioned in the issue body,
// and checks whether that file's content actually references the issue
// number. Flags files that are missing the marker so they don't look
// like unclaimed empty stubs to someone browsing the codebase directly.
//
// This only DETECTS missing markers — it does not write the explanatory
// comment itself. That's intentional: a good marker comment needs
// context/nuance (why deferred, what the actual scope is) that a script
// can't meaningfully generate. Run this, then write the comment by hand
// (or ask Claude to draft one) for anything it flags.
//
// KNOWN LIMITATION: cannot distinguish between "a file the assignee is
// supposed to create/modify" and "a file mentioned only as a reference
// example to read first" (e.g. issue #53 tells Alitindrawan24 to read
// packages/rules/nextjs/requirePage.ts as a pattern to follow — that file
// is NOT his task, but this script still flags it as missing a marker).
// Treat this script's output as a starting point for manual review, not
// an authoritative list to blindly act on.
//
// Run with: npx tsx scripts/checkCollaboratorMarkers.ts
// Requires: gh CLI installed and authenticated (same as everywhere else
// in this repo's workflow).

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

interface GhIssue {
  number: number;
  assignees: { login: string }[];
  body: string;
}

const FILE_PATH_PATTERN = /(?:packages|apps|scripts|tests)\/[A-Za-z0-9_\-/]+\.(?:ts|tsx)/g;

function getOpenAssignedIssues(): GhIssue[] {
  const raw = execSync("gh issue list --state open --json number,assignees,body --limit 200", {
    encoding: "utf-8",
  });
  const issues: GhIssue[] = JSON.parse(raw);
  return issues.filter((issue) => issue.assignees.length > 0);
}

function extractFilePaths(body: string): string[] {
  const matches = body.match(FILE_PATH_PATTERN) ?? [];
  return Array.from(new Set(matches));
}

function fileHasMarker(filePath: string, issueNumber: number): boolean {
  if (!existsSync(filePath)) return false; // not created yet — nothing to check, not a violation
  const content = readFileSync(filePath, "utf-8");
  return content.includes(`#${issueNumber}`);
}

function main() {
  const issues = getOpenAssignedIssues();
  const problems: { issue: number; assignee: string; file: string; reason: string }[] = [];

  for (const issue of issues) {
    const assignee = issue.assignees.map((a) => a.login).join(", ");
    const filePaths = extractFilePaths(issue.body);

    for (const filePath of filePaths) {
      if (!existsSync(filePath)) {
        // File doesn't exist yet (not written). Not flagged as a problem —
        // there's nothing to mark until the file exists. Shown as info only.
        console.log(`  (info) #${issue.number} (${assignee}) references ${filePath}, which doesn't exist yet`);
        continue;
      }

      if (!fileHasMarker(filePath, issue.number)) {
        problems.push({
          issue: issue.number,
          assignee,
          file: filePath,
          reason: `file exists but has no comment mentioning #${issue.number}`,
        });
      }
    }
  }

  if (problems.length === 0) {
    console.log("\nAll collaborator-assigned files that exist are properly marked.");
    return;
  }

  console.log(`\n${problems.length} file(s) missing a collaborator marker comment:\n`);
  for (const p of problems) {
    console.log(`  MISSING MARKER: ${p.file}`);
    console.log(`    Issue #${p.issue}, assignee: ${p.assignee}`);
    console.log(`    ${p.reason}\n`);
  }
  process.exitCode = 1;
}

main();
