// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Real-mechanics tests for packages/db/ (issue #455) — the JSON-file-per-
// record client and its RepoStore/AnalysisStore/IssueStore wrappers.
// ARCLUX_ROOT is pointed at a temp dir so nothing touches the real home
// directory.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { putRecord, getRecord, listRecords, deleteRecord } from "../packages/db/client";
import { saveRepo, getRepo, listRepos, deleteRepo } from "../packages/db/repositories/RepoStore";
import { saveAnalysis, getAnalysis, listAnalysesForRepo } from "../packages/db/repositories/AnalysisStore";
import { saveIssues, listIssuesForAnalysis, listIssuesForRepo, clearIssuesForAnalysis } from "../packages/db/repositories/IssueStore";
import type { RepositoryMeta } from "../packages/shared/types";
import type { AnalyzeRepositoryResult } from "../packages/engine/pipeline";
import type { Issue } from "../packages/engine/contract";
import { Repository } from "../packages/repository/Repository";

const OLD_ARCLUX_ROOT = process.env.ARCLUX_ROOT;
let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "arclux-db-test-"));
  process.env.ARCLUX_ROOT = root;
});

afterAll(() => {
  if (OLD_ARCLUX_ROOT === undefined) delete process.env.ARCLUX_ROOT;
  else process.env.ARCLUX_ROOT = OLD_ARCLUX_ROOT;
  rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
});

afterEach(() => {
  // nothing persists across tests — root is recreated per test
});

interface SampleRecord {
  id: string;
  value: string;
}

describe("db client", () => {
  it("round-trips a record and strips __schemaVersion on read", () => {
    putRecord<SampleRecord>("repos", { id: "r1", value: "v" });
    const read = getRecord<SampleRecord>("repos", "r1");
    expect(read).toEqual({ id: "r1", value: "v" });
    expect(read).not.toHaveProperty("__schemaVersion");
  });

  it("returns null for a missing record and for a corrupt file", () => {
    expect(getRecord("repos", "nope")).toBeNull();
    const dir = join(root, "db", "repos");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "corrupt.json"), "not json");
    expect(getRecord("repos", "corrupt")).toBeNull();
  });

  it("lists records and skips corrupt files without throwing", () => {
    putRecord<SampleRecord>("repos", { id: "a", value: "1" });
    putRecord<SampleRecord>("repos", { id: "b", value: "2" });
    const dir = join(root, "db", "repos");
    writeFileSync(join(dir, "corrupt.json"), "not json");
    const records = listRecords<SampleRecord>("repos");
    expect(records.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("deletes a record and tolerates deleting a missing one", () => {
    putRecord<SampleRecord>("repos", { id: "a", value: "1" });
    deleteRecord("repos", "a");
    expect(getRecord("repos", "a")).toBeNull();
    expect(() => deleteRecord("repos", "missing")).not.toThrow();
  });
});

describe("RepoStore", () => {
  const meta: RepositoryMeta = {
    id: "repo-1",
    org: "acme",
    name: "app",
    defaultBranch: "main",
    rootPath: "/repo/app",
    detectedFrameworks: ["react"],
    packageManager: "npm",
    analyzedAt: "2026-08-15T00:00:00.000Z",
  };

  it("saves and reads a repo from RepositoryMeta", () => {
    saveRepo(meta);
    expect(getRepo("repo-1")).toEqual(meta);
  });

  it("lists all saved repos and deletes one", () => {
    saveRepo(meta);
    saveRepo({ ...meta, id: "repo-2", name: "other" });
    expect(listRepos().map((r) => r.id).sort()).toEqual(["repo-1", "repo-2"]);
    deleteRepo("repo-1");
    expect(getRepo("repo-1")).toBeNull();
  });
});

function fakeResult(moduleCount: number, nodes: number, edges: number): AnalyzeRepositoryResult {
  const meta: RepositoryMeta = {
    id: "local",
    org: "local",
    name: "app",
    defaultBranch: "local",
    rootPath: "/repo/app",
    detectedFrameworks: [],
    packageManager: "npm",
    analyzedAt: "2026-08-15T10:00:00.000Z",
  };
  return {
    meta,
    moduleCount,
    graph: {
      repositoryId: "g",
      nodes: Array.from({ length: nodes }, (_, i) => ({ id: `n${i}`, type: "file", label: `n${i}` })),
      edges: Array.from({ length: edges }, (_, i) => ({ id: `e${i}`, source: "a", target: "b", type: "import" })),
      builtAt: "2026-08-15T10:00:00.000Z",
    },
    scanSummary: { filesScanned: 0, filesParsed: 0, filesSkippedNoParser: 0, skippedByExtension: {} },
    repository: new Repository(meta),
    dependencies: [],
  };
}

describe("AnalysisStore", () => {
  it("saves an analysis summary and reads it back", () => {
    const record = saveAnalysis("repo-1", fakeResult(12, 20, 31));
    const read = getAnalysis(record.id);
    expect(read).not.toBeNull();
    expect(read!.repoId).toBe("repo-1");
    expect(read!.moduleCount).toBe(12);
    expect(read!.nodeCount).toBe(20);
    expect(read!.edgeCount).toBe(31);
  });

  it("lists analyses for a repo, most recent first", () => {
    const older = saveAnalysis("repo-1", { ...fakeResult(1, 1, 1), meta: { ...fakeResult(1, 1, 1).meta, analyzedAt: "2026-08-15T08:00:00.000Z" } });
    const newer = saveAnalysis("repo-1", { ...fakeResult(2, 2, 2), meta: { ...fakeResult(2, 2, 2).meta, analyzedAt: "2026-08-15T09:00:00.000Z" } });
    saveAnalysis("repo-2", fakeResult(3, 3, 3));
    const forRepo = listAnalysesForRepo("repo-1");
    expect(forRepo.map((r) => r.id)).toEqual([newer.id, older.id]);
  });
});

describe("IssueStore", () => {
  const issues: Issue[] = [
    { source: "detector", checkId: "circularDependency", severity: "error", message: "cycle" },
    { source: "rule", checkId: "requirePage", severity: "warning", message: "no page" },
  ];

  it("saves issues tied to an analysis and lists them by analysis/repo", () => {
    const records = saveIssues("repo-1", "analysis-1", issues);
    expect(records).toHaveLength(2);
    const byAnalysis = listIssuesForAnalysis("analysis-1");
    expect(byAnalysis.map((r) => r.checkId).sort()).toEqual(["circularDependency", "requirePage"]);
    expect(listIssuesForAnalysis("analysis-2")).toEqual([]);
    expect(listIssuesForRepo("repo-1")).toHaveLength(2);
    expect(listIssuesForRepo("repo-2")).toEqual([]);
  });

  it("clears all issues for one analysis run", () => {
    saveIssues("repo-1", "analysis-1", issues);
    saveIssues("repo-1", "analysis-2", [issues[0]]);
    clearIssuesForAnalysis("analysis-1");
    expect(listIssuesForAnalysis("analysis-1")).toEqual([]);
    expect(listIssuesForAnalysis("analysis-2")).toHaveLength(1);
  });
});
