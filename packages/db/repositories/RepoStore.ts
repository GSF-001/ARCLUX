// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Wraps packages/db/client.ts for the "repos" collection. Maps to/from
// RepositoryMeta (packages/shared/types.ts) -- same shape AnalyzeRepositoryResult.meta
// already produces, no new shape invented.

import { putRecord, getRecord, listRecords, deleteRecord } from "../client";
import type { RepoRecord } from "../schema";
import type { RepositoryMeta } from "../../shared/types";

export function saveRepo(meta: RepositoryMeta): void {
  const record: RepoRecord = {
    id: meta.id,
    org: meta.org,
    name: meta.name,
    defaultBranch: meta.defaultBranch,
    rootPath: meta.rootPath,
    detectedFrameworks: meta.detectedFrameworks,
    packageManager: meta.packageManager,
    analyzedAt: meta.analyzedAt,
  };
  putRecord("repos", record);
}

export function getRepo(id: string): RepoRecord | null {
  return getRecord<RepoRecord>("repos", id);
}

export function listRepos(): RepoRecord[] {
  return listRecords<RepoRecord>("repos");
}

export function deleteRepo(id: string): void {
  deleteRecord("repos", id);
}
