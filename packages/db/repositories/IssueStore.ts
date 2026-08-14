// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Wraps packages/db/client.ts for the "issues" collection. Persists
// findings from packages/engine/contract.ts's runAllChecks() (10 detectors
// + rule engine, aggregated into one Issue[] list) tied to an analysis run,
// so past issues can be queried without re-running detectors.

import { randomUUID } from "node:crypto";
import { putRecord, listRecords, deleteRecord } from "../client";
import type { IssueRecord } from "../schema";
import type { Issue } from "../../engine/contract";

export function saveIssues(repoId: string, analysisId: string, issues: Issue[]): IssueRecord[] {
  const now = new Date().toISOString();
  const records: IssueRecord[] = issues.map((issue) => ({
    id: randomUUID(),
    repoId,
    analysisId,
    source: issue.source,
    checkId: issue.checkId,
    severity: issue.severity,
    message: issue.message,
    createdAt: now,
  }));

  for (const record of records) {
    putRecord("issues", record);
  }
  return records;
}

export function listIssuesForAnalysis(analysisId: string): IssueRecord[] {
  return listRecords<IssueRecord>("issues").filter((r) => r.analysisId === analysisId);
}

export function listIssuesForRepo(repoId: string): IssueRecord[] {
  return listRecords<IssueRecord>("issues").filter((r) => r.repoId === repoId);
}

/** Deletes every issue record belonging to one analysis run -- e.g. before re-saving a fresh set. */
export function clearIssuesForAnalysis(analysisId: string): void {
  for (const record of listIssuesForAnalysis(analysisId)) {
    deleteRecord("issues", record.id);
  }
}
