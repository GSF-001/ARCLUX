// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { simpleGit } from "simple-git";

export interface Contributor {
  name: string;
  email: string;
  /** Total commits by this contributor (excluding merges). */
  commits: number;
}

/**
 * Aggregates commit authors for a local clone at localPath via
 * `git shortlog -sne --no-merges` — one entry per author, sorted by
 * commit count descending. Requires a full (non-shallow) clone — use
 * cloneRepository({ depth: 0 }), see getCommitHistory.ts's note.
 */
export async function getContributors(localPath: string): Promise<Contributor[]> {
  const git = simpleGit(localPath);
  const output = await git.raw(["shortlog", "-sne", "--no-merges", "HEAD"]);

  const contributors: Contributor[] = [];
  for (const line of output.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(.+?)\s*<([^>]+)>$/);
    if (!match) continue;
    contributors.push({
      commits: Number(match[1]),
      name: match[2],
      email: match[3],
    });
  }
  return contributors;
}
