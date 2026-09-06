// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { execFileSync } from "node:child_process";

/**
 * Resolves the `origin` remote URL of a local git repository, via
 * `git config --get remote.origin.url`. Returns null when:
 *   - `cwd` is not a git repository
 *   - no `origin` remote is configured
 *
 * Same execFileSync-array pattern as getBranches.ts / detectDefaultBranch.ts
 * — no shell, no injection surface.
 */
export function getRemoteOriginUrl(cwd: string): string | null {
  try {
    const url = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      encoding: "utf-8",
      cwd,
      timeout: 5_000,
    }).trim();
    return url || null;
  } catch {
    return null;
  }
}
