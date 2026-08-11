// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// LAB 1 MVP — genuinely limited scope, documented honestly:
//
// This does NOT build two separate dependency graphs (one at refA, one at
// refB) and diff them. That would require checking out each ref into a
// clean state and running the full pipeline twice — real work, not yet
// built. What this DOES do: get the changed-files list from git (cheap),
// then run existing impact analysis (traceConsumers, already-built and
// verified) against the CURRENT working tree for each changed file that
// still exists. This tells you "what's affected by files that changed
// between these two points" using today's graph — not "what did the
// dependency graph itself look like differently at each point."
//
// This is useful as-is (answers "if I touch what changed, what's the
// blast radius") but is NOT the full "architectural diff" from the
// original LAB 1 design doc. Upgrading to true dual-graph comparison is
// a separate, larger task — see progres/PROGRES-decisions.md.

import type { Repository } from "../repository/Repository";
import { getChangedFiles } from "./gitDiff";
import { traceConsumers } from "../impact/traceConsumers";
import type { ChangedFile } from "./types";

export interface ArchitecturalDiffResult {
  changedFiles: ChangedFile[];
  affectedFiles: string[];
}

export function computeArchitecturalDiff(
  repository: Repository,
  repoPath: string,
  refA: string,
  refB: string
): ArchitecturalDiffResult {
  const changedFiles = getChangedFiles(repoPath, refA, refB);
  const affected = new Set<string>();

  for (const changed of changedFiles) {
    if (changed.status === "deleted") continue; // not in current graph, can't trace
    const module = repository.getModule(changed.path);
    if (!module) continue; // file not indexed (e.g. not a supported language)

    const consumers = traceConsumers(repository, changed.path);
    for (const id of consumers.transitive) affected.add(id);
  }

  return { changedFiles, affectedFiles: Array.from(affected) };
}
