// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Walks up from a starting directory to find the nearest ancestor
// containing a .git folder -- same "find the repo root" pattern git
// itself, ESLint, Prettier, and most dev tools use, so `arclux daemon`
// run from any subfolder still watches the whole repo, not just the
// subfolder the developer happened to be in.

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

export interface DetectedEnvironment {
  /** absolute path to the repository root (the directory containing .git) */
  repositoryRoot: string;
  /** true if startPath itself was the root; false if a walk-up was needed */
  wasStartPath: boolean;
}

/**
 * Walks up from startPath looking for a .git directory. Returns null if
 * none is found before reaching the filesystem root (e.g. startPath isn't
 * inside a git repo at all) -- callers should fall back to startPath itself
 * in that case, not treat null as an error.
 */
export function detectRepositoryRoot(startPath: string): DetectedEnvironment | null {
  let current = startPath;

  while (true) {
    if (existsSync(join(current, ".git"))) {
      return { repositoryRoot: current, wasStartPath: current === startPath };
    }

    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root without finding .git.
      return null;
    }
    current = parent;
  }
}

/** Convenience wrapper: detectRepositoryRoot(startPath), falling back to startPath itself if no .git is found anywhere above it. */
export function resolveWorkingRepositoryRoot(startPath: string): string {
  return detectRepositoryRoot(startPath)?.repositoryRoot ?? startPath;
}
