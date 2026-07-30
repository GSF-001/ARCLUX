import { simpleGit } from "simple-git";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AriesError } from "../shared/errors";

export interface CloneOptions {
  /** e.g. "https://github.com/org/repo.git" */
  repoUrl: string;
  /** Branch to checkout. Defaults to the repo's default branch if omitted. */
  branch?: string;
  /** Shallow clone depth. Defaults to 1 (fastest, no history) */
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
  const { repoUrl, branch, depth = 1 } = options;

  const workDir = mkdtempSync(join(tmpdir(), "aries-"));
  const git = simpleGit();

  try {
    const cloneArgs = ["--depth", String(depth)];
    if (branch) {
      cloneArgs.push("--branch", branch);
    }

    await git.clone(repoUrl, workDir, cloneArgs);

    const repoGit = simpleGit(workDir);
    const status = await repoGit.status();
    const resolvedBranch = branch ?? status.current ?? "main";

    return { localPath: workDir, branch: resolvedBranch };
  } catch (err) {
    throw new AriesError({
      code: "CLONE_FAILED",
      message: `Failed to clone repository: ${repoUrl}`,
      cause: err,
    });
  }
}
