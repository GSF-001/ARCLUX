// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { simpleGit } from "simple-git";

export interface CommitInfo {
  hash: string;
  /** ISO date of the commit */
  date: string;
  message: string;
  authorName: string;
  authorEmail: string;
}

export interface GetCommitHistoryOptions {
  /** Max commits to return. Default: 20. */
  maxCount?: number;
  /** Branch/ref to log (default: current branch). */
  branch?: string;
  /** Only commits touching this path (file or directory, repo-relative). */
  path?: string;
}

/**
 * Returns commit history for a local clone at localPath via
 * `git log`. Requires a full (non-shallow) clone to see history — use
 * cloneRepository({ depth: 0 }); the shallow default (depth 1) has no
 * log data.
 */
export async function getCommitHistory(
  localPath: string,
  options: GetCommitHistoryOptions = {}
): Promise<CommitInfo[]> {
  const { maxCount = 20, branch, path } = options;
  const git = simpleGit(localPath);

  const log = await git.log({
    maxCount,
    from: branch,
    file: path,
  });

  return log.all.map((commit) => ({
    hash: commit.hash,
    date: commit.date,
    message: commit.message,
    authorName: commit.author_name,
    authorEmail: commit.author_email,
  }));
}
