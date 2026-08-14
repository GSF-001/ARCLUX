// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Wraps packages/db/client.ts for the "analyses" collection. One record
// per analyzeRepository() run -- a lightweight summary (counts + timestamp),
// NOT the full DependencyGraph/Repository (those are large and already
// re-derivable by re-running analysis; this store is for history/trend
// queries like "how has moduleCount changed over time", not a graph cache).

import { randomUUID } from "node:crypto";
import { putRecord, getRecord, listRecords } from "../client";
import type { AnalysisRecord } from "../schema";
import type { AnalyzeRepositoryResult } from "../../engine/pipeline";

export function saveAnalysis(repoId: string, result: AnalyzeRepositoryResult): AnalysisRecord {
  const record: AnalysisRecord = {
    id: randomUUID(),
    repoId,
    moduleCount: result.moduleCount,
    nodeCount: result.graph.nodes.length,
    edgeCount: result.graph.edges.length,
    analyzedAt: result.meta.analyzedAt,
  };
  putRecord("analyses", record);
  return record;
}

export function getAnalysis(id: string): AnalysisRecord | null {
  return getRecord<AnalysisRecord>("analyses", id);
}

/** All analysis records for one repo, most recent first. */
export function listAnalysesForRepo(repoId: string): AnalysisRecord[] {
  return listRecords<AnalysisRecord>("analyses")
    .filter((r) => r.repoId === repoId)
    .sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt));
}
