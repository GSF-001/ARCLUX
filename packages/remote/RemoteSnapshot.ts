// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { hashObject } from "../shared/hash";
import type { Repository } from "../repository/Repository";
import type { DependencyGraph } from "../shared/types";
import type { AnalyzeRepositoryResult } from "../engine/pipeline";
import type { SecurityFinding } from "../security-analysis/SecurityFinding";
import type { ProvenanceRecord } from "../provenance/ProvenanceRecord";
import type { RemoteSource } from "./RemoteSource";

/**
 * A point-in-time capture of one analysis run: the source that was
 * analyzed, the core outputs (Repository + DependencyGraph), the security
 * findings, and (optionally) the provenance chain that explains where it
 * all came from. Immutable by convention — consumers read, never mutate.
 */
export interface RemoteSnapshot {
  /**
   * Deterministic id over source + repository + graph identity:
   * stable for the same source/commit, new for a different analysis.
   */
  id: string;
  source: RemoteSource;
  /** ISO timestamp of snapshot creation. */
  createdAt: string;
  repository: Repository;
  graph: DependencyGraph;
  findings: SecurityFinding[];
  /** Provenance chain for this snapshot's findings, when recorded. */
  provenance?: ProvenanceRecord[];
}

export interface CreateRemoteSnapshotInput {
  source: RemoteSource;
  result: AnalyzeRepositoryResult;
  findings?: SecurityFinding[];
  provenance?: ProvenanceRecord[];
}

/** Assembles a RemoteSnapshot from a core pipeline result + findings. */
export function createRemoteSnapshot(input: CreateRemoteSnapshotInput): RemoteSnapshot {
  const { source, result, findings = [], provenance } = input;
  const createdAt = new Date().toISOString();

  const snapshot: RemoteSnapshot = {
    id: `snap-${hashObject({
      source: { url: source.url, localPath: source.localPath, branch: source.branch },
      repositoryId: result.repository.meta.id,
    })}`,
    source,
    createdAt,
    repository: result.repository,
    graph: result.graph,
    findings,
  };
  if (provenance !== undefined) snapshot.provenance = provenance;
  return snapshot;
}
