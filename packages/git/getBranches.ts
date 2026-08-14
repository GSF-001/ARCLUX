// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { execFileSync } from "node:child_process";

/**
 * Lists the remote branches of repoUrl WITHOUT cloning, via
 * `git ls-remote --heads`. execFileSync with an argument array (no shell)
 * means repoUrl never reaches a shell — no command-injection surface
 * (same pattern as the git-diff exec in KI-010).
 *
 * Throws (execFileSync) if the URL isn't a reachable git repo — callers
 * decide how to surface that.
 */
export function getBranches(repoUrl: string): string[] {
  const output = execFileSync("git", ["ls-remote", "--heads", repoUrl], {
    encoding: "utf-8",
    // ls-remote of a large repo can take a few seconds; cap it so a
    // misbehaving host can't hang a request forever.
    timeout: 30_000,
  });

  const branches: string[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^[0-9a-f]+\s+refs\/heads\/(.+)$/);
    if (match) branches.push(match[1]);
  }
  return branches.sort();
}
