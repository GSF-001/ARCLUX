// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { execFileSync } from "node:child_process";

/**
 * Detects the default branch (HEAD symref target) of repoUrl without
 * cloning, via `git ls-remote --symref <url> HEAD`, whose first line is
 * `ref: refs/heads/<name>\tHEAD`. Returns null when HEAD isn't a symref
 * (unusual). Same execFileSync-array pattern as getBranches.ts — no
 * shell, no injection surface.
 */
export function detectDefaultBranch(repoUrl: string): string | null {
  const output = execFileSync("git", ["ls-remote", "--symref", repoUrl, "HEAD"], {
    encoding: "utf-8",
    timeout: 30_000,
  });

  const match = output.match(/^ref:\s+refs\/heads\/(\S+)\s+HEAD/m);
  return match ? match[1] : null;
}
