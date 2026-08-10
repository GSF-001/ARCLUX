// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// LAB 1 MVP: uses `git diff --name-status`, the simplest possible way to
// get changed files between two refs. Does NOT check out either ref —
// that's why architecturalDiff.ts (see its own comment) only computes
// impact against the CURRENT working tree, not a true two-graph
// comparison yet.

import { execSync } from "node:child_process";
import type { ChangedFile, ChangeStatus } from "./types";

const STATUS_MAP: Record<string, ChangeStatus> = {
  A: "added",
  M: "modified",
  D: "deleted",
};

export function getChangedFiles(repoPath: string, refA: string, refB: string): ChangedFile[] {
  const output = execSync(`git diff --name-status ${refA} ${refB}`, {
    cwd: repoPath,
    encoding: "utf-8",
  });

  const files: ChangedFile[] = [];
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const [statusChar, ...pathParts] = line.split("\t");
    const status = STATUS_MAP[statusChar.charAt(0)];
    if (!status) continue; // skip renames (R100 etc) for this MVP — not handled yet
    files.push({ path: pathParts.join("\t"), status });
  }
  return files;
}
