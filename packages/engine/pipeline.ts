import { randomUUID } from "node:crypto";
import { cloneRepository } from "../git/cloneRepository";
import { cleanupRepository } from "../git/cleanupRepository";
import { buildIndex } from "../indexer/buildIndex";
import { buildDependencyGraph } from "../graph/buildDependencyGraph";
import { parserRegistry } from "../parser/core/ParserRegistry";
import { parseTs } from "../parser/typescript/parseTs";
import { detectFrameworks, detectPackageManager } from "./detectRepositoryMeta";
import { AriesError, isAriesError } from "../shared/errors";
import type { DependencyGraph, RepositoryMeta } from "../shared/types";
import type { Repository } from "../repository/Repository";

// Register known parsers once, at module load. As more languages get parser
// implementations (parseJs, parsePython, ...) they get registered here too.
let parsersRegistered = false;
function ensureParsersRegistered() {
  if (parsersRegistered) return;
  parserRegistry.register(parseTs);
  parsersRegistered = true;
}

export interface AnalyzeRepositoryOptions {
  repoUrl: string;
  branch?: string;
}

export interface AnalyzeRepositoryResult {
  meta: RepositoryMeta;
  moduleCount: number;
  graph: DependencyGraph;
}

/** Parses "org/name" out of a git URL, for https, ssh, and shorthand forms */
function parseOrgAndName(repoUrl: string): { org: string; name: string } {
  const cleaned = repoUrl.replace(/\.git$/, "");
  const match = cleaned.match(/[:/]([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new AriesError({
      code: "CLONE_FAILED",
      message: `Could not parse org/repo name from URL: ${repoUrl}`,
    });
  }
  return { org: match[1], name: match[2] };
}

/**
 * The single entry point for "analyze this repo". Everything else (CLI command,
 * API route, future queue worker) should call THIS, not the individual steps —
 * that keeps clone/cleanup lifecycle correct in exactly one place.
 */
export async function analyzeRepository(
  options: AnalyzeRepositoryOptions
): Promise<AnalyzeRepositoryResult> {
  ensureParsersRegistered();

  const { org, name } = parseOrgAndName(options.repoUrl);
  let localPath: string | undefined;

  try {
    const cloneResult = await cloneRepository({
      repoUrl: options.repoUrl,
      branch: options.branch,
    });
    localPath = cloneResult.localPath;

    const meta: RepositoryMeta = {
      id: randomUUID(),
      org,
      name,
      defaultBranch: cloneResult.branch,
      rootPath: localPath,
      detectedFrameworks: detectFrameworks(localPath),
      packageManager: detectPackageManager(localPath),
      analyzedAt: new Date().toISOString(),
    };

    let repository: Repository;
    try {
      repository = await buildIndex({ rootPath: localPath, meta });
    } catch (err) {
      throw isAriesError(err)
        ? err
        : new AriesError({ code: "INDEX_FAILED", message: "Indexing failed", cause: err });
    }

    let graph: DependencyGraph;
    try {
      graph = buildDependencyGraph(repository);
    } catch (err) {
      throw new AriesError({
        code: "GRAPH_BUILD_FAILED",
        message: "Graph construction failed",
        cause: err,
      });
    }

    return {
      meta: repository.meta,
      moduleCount: repository.moduleCount,
      graph,
    };
  } finally {
    // Always clean up the temp clone, even if analysis threw partway through.
    if (localPath) {
      await cleanupRepository(localPath).catch(() => {
        // best-effort — don't let a cleanup failure mask the real error
      });
    }
  }
}
