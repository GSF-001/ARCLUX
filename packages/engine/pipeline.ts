// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { randomUUID } from "node:crypto";
import { cloneRepository } from "../git/cloneRepository";
import { cleanupRepository } from "../git/cleanupRepository";
import { buildIndex } from "../indexer/buildIndex";
import { buildDependencyGraph } from "../graph/buildDependencyGraph";
import { parserRegistry } from "../parser/core/ParserRegistry";
import { parseTs } from "../parser/typescript/parseTs";
import { parsePython } from "../parser/python/parsePython";
import { parseJs } from "../parser/javascript/parseJs";
import { parseJsx } from "../parser/javascript/parseJsx";
import { parseCommonJs } from "../parser/javascript/parseCommonJs";
import { parseGo } from "../parser/go/parseGo";
import { parseJava } from "../parser/java/parseJava";
import { detectFrameworks, detectPackageManager } from "./detectRepositoryMeta";
import { ArcluxError, isArcluxError } from "../shared/errors";
import type { DependencyGraph, RepositoryMeta } from "../shared/types";
import type { Repository } from "../repository/Repository";

// Register known parsers once, at module load. As more languages get parser
// implementations (parseJs, parsePython, ...) they get registered here too.
let parsersRegistered = false;
function ensureParsersRegistered() {
  if (parsersRegistered) return;
  parserRegistry.register(parseTs);
  parserRegistry.register(parsePython);
  parserRegistry.register(parseJs);
  parserRegistry.register(parseJsx);
  parserRegistry.register(parseCommonJs);
  parserRegistry.register(parseGo);
  parserRegistry.register(parseJava);
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
  /**
   * Full in-memory Repository, for server-side consumers that need to run
   * detectors/impact analysis (CLI, /api/impact, /api/search) without
   * re-indexing. NEVER JSON.stringify this directly or spread it into an
   * API response — Repository stores modules in a private Map, which
   * serializes to an empty {} (silent data loss, not a crash). Route
   * handlers must derive a plain-object shape from it first (see
   * calculateAffectedFiles usage in api/impact/route.ts for the pattern).
   */
  repository: Repository;
}

/** Parses "org/name" out of a git URL, for https, ssh, and shorthand forms */
export function parseOrgAndName(repoUrl: string): { org: string; name: string } {
  const cleaned = repoUrl.replace(/\.git$/, "");
  const match = cleaned.match(/[:/]([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new ArcluxError({
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
      throw isArcluxError(err)
        ? err
        : new ArcluxError({ code: "INDEX_FAILED", message: "Indexing failed", cause: err });
    }

    let graph: DependencyGraph;
    try {
      graph = buildDependencyGraph(repository);
    } catch (err) {
      throw new ArcluxError({
        code: "GRAPH_BUILD_FAILED",
        message: "Graph construction failed",
        cause: err,
      });
    }

    return {
      meta: repository.meta,
      moduleCount: repository.moduleCount,
      graph,
      repository,
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
