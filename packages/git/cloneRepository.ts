// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { simpleGit } from "simple-git";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArcluxError } from "../shared/errors";

export interface CloneOptions {
  /** e.g. "https://github.com/org/repo.git" */
  repoUrl: string;
  /** Branch to checkout. Defaults to the repo's default branch if omitted. */
  branch?: string;
  /** Shallow clone depth. Defaults to 1 (fastest, no history).
   * Pass 0 for a FULL clone (history included) — e.g. for getCommitHistory/
   * getContributors, which need git log data. */
  depth?: number;
}

export interface CloneResult {
  /** Local filesystem path where the repo was cloned */
  localPath: string;
  branch: string;
}

/**
 * Clones a repo into a temp directory. Caller is responsible for calling
 * cleanupRepository.ts on `localPath` once analysis is done.
 */
export async function cloneRepository(options: CloneOptions): Promise<CloneResult> {
  const { repoUrl, branch } = options;
  const depth = options.depth ?? 1;

  const workDir = mkdtempSync(join(tmpdir(), "arclux-"));
  const git = simpleGit();

  try {
    const cloneArgs: string[] = [];
    if (depth > 0) {
      cloneArgs.push("--depth", String(depth));
    }
    if (branch) {
      cloneArgs.push("--branch", branch);
    }

    await git.clone(repoUrl, workDir, cloneArgs);

    const repoGit = simpleGit(workDir);
    const status = await repoGit.status();
    const resolvedBranch = branch ?? status.current ?? "main";

    return { localPath: workDir, branch: resolvedBranch };
  } catch (err) {
    throw new ArcluxError({
      code: "CLONE_FAILED",
      message: `Failed to clone repository: ${repoUrl}`,
      cause: err,
    });
  }
}
