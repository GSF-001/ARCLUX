// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { simpleGit } from "simple-git";

/**
 * Checks out `branch` in an existing local clone at localPath.
 *
 * Order of attempts (first success wins):
 * 1. Already on `branch` — no-op.
 * 2. Create a local tracking branch from origin (`checkout -b branch
 *    origin/branch`) — first fetches so a shallow clone (depth 1, the
 *    pipeline's default) can see the remote branch at all.
 * 3. Plain `checkout branch` — for branches that exist only locally.
 *
 * Throws if none succeed (simple-git error propagates to the caller).
 */
export async function checkoutBranch(localPath: string, branch: string): Promise<void> {
  const git = simpleGit(localPath);

  const status = await git.status();
  if (status.current === branch) return;

  try {
    await git.fetch(["origin", branch]);
    await git.checkoutBranch(branch, `origin/${branch}`);
  } catch {
    await git.checkout(branch);
  }
}
