// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Analyzes a LOCAL directory directly (buildIndex + buildDependencyGraph),
// bypassing analyzeRepository()'s clone/cleanup lifecycle in
// packages/engine/pipeline.ts — that lifecycle is designed for remote
// repoUrl, not local paths the CLI is pointed at.
//
// This mirrors scripts/testPlayground.ts and is the SAME sanctioned
// exception documented in PROGRES.md: calling engine/ steps individually
// is fine for local-path call sites, just not for production remote-repo
// flows (those must go through analyzeRepository()).
//
// NOTE: a parallel session was reportedly planning to refactor pipeline.ts
// to add local-path support + a findings[] field directly to
// AnalyzeRepositoryResult. As of this file being written, pipeline.ts
// still only returns { meta, moduleCount, graph } — no findings[], no
// local-path entry point. Once that refactor lands, THIS FILE should be
// deleted and every command below should call the engine API instead of
// duplicating orchestration here.

import path from "node:path";
import { buildIndex } from "../../packages/indexer/buildIndex";
import { buildDependencyGraph } from "../../packages/graph/buildDependencyGraph";
import { detectFrameworks, detectPackageManager } from "../../packages/engine/detectRepositoryMeta";
import { parserRegistry } from "../../packages/parser/core/ParserRegistry";
import { parseTs } from "../../packages/parser/typescript/parseTs";
import { parsePython } from "../../packages/parser/python/parsePython";
import type { RepositoryMeta, DependencyGraph } from "../../packages/shared/types";
import type { Repository } from "../../packages/repository/Repository";

let parsersRegistered = false;
function ensureParsersRegistered(): void {
  if (parsersRegistered) return;
  parserRegistry.register(parseTs);
  parserRegistry.register(parsePython);
  parsersRegistered = true;
}

export interface LocalAnalysisResult {
  repository: Repository;
  meta: RepositoryMeta;
  graph: DependencyGraph;
}

export async function analyzeLocalDirectory(rootPath: string): Promise<LocalAnalysisResult> {
  ensureParsersRegistered();
  const resolvedPath = path.resolve(rootPath);

  const meta: RepositoryMeta = {
    id: "local",
    org: "local",
    name: path.basename(resolvedPath),
    defaultBranch: "local",
    rootPath: resolvedPath,
    detectedFrameworks: detectFrameworks(resolvedPath),
    packageManager: detectPackageManager(resolvedPath),
    analyzedAt: new Date().toISOString(),
  };

  const repository = await buildIndex({ rootPath: resolvedPath, meta });
  const graph = buildDependencyGraph(repository);

  return { repository, meta, graph };
}
