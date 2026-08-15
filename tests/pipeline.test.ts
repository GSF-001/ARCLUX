// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Pipeline tests against a SMALL deterministic fixture
// (tests/fixtures/pipeline-basic: entry.ts -> service.ts -> repository.ts)
// instead of the whole repo. Fixes issue #425:
//   - the previous hardcoded temp fixture path (ThreatCrush MEDIUM
//     insecure-temp-file finding) is replaced with a portable os.tmpdir()
//     path that is never created — analyzeRepository throws on the
//     both-args case BEFORE any filesystem access.
//   - `moduleCount >= 0` + shape-only assertions replaced with concrete
//     facts: exact module count, scan accounting, dependency edges.

import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import os from "node:os";
import { analyzeRepository, type AnalyzeRepositoryResult } from "../packages/engine/pipeline";

const FIXTURE_PATH = path.join(__dirname, "fixtures", "pipeline-basic");

describe("Pipeline: analyzeRepository — argument validation", () => {
  it("should throw when both repoUrl and localPath are provided", async () => {
    // The path is never created or touched: analyzeRepository validates the
    // options and throws before any clone/scan I/O. os.tmpdir() is used (not
    // a hardcoded temp path) so the intent is portable and ThreatCrush-clean.
    const unusedLocalPath = path.join(os.tmpdir(), "arclux-test-never-created");
    await expect(
      analyzeRepository({
        repoUrl: "https://github.com/test/repo",
        localPath: unusedLocalPath,
      })
    ).rejects.toThrow("provide either repoUrl or localPath");
  });

  it("should throw when neither repoUrl nor localPath are provided", async () => {
    await expect(analyzeRepository({})).rejects.toThrow("repoUrl or localPath is required");
  });
});

describe("Pipeline: analyzeRepository — deterministic fixture", () => {
  let result: AnalyzeRepositoryResult;

  beforeAll(async () => {
    result = await analyzeRepository({ localPath: FIXTURE_PATH });
  }, 30_000);

  it("indexes exactly the 3 fixture modules", () => {
    expect(result.moduleCount).toBe(3);
    const ids = result.repository.getAllModules().map((m) => m.id).sort();
    expect(ids).toEqual(["entry.ts", "repository.ts", "service.ts"]);
  });

  it("records accurate scan accounting", () => {
    expect(result.scanSummary.filesScanned).toBe(3);
    expect(result.scanSummary.filesParsed).toBe(3);
    expect(result.scanSummary.filesSkippedNoParser).toBe(0);
    expect(result.scanSummary.skippedByExtension).toEqual({});
  });

  it("builds the expected dependency edges (entry -> service -> repository)", () => {
    const edges = result.graph.edges.map((e) => `${e.source}->${e.target}`).sort();
    expect(edges).toEqual(["entry.ts->service.ts", "service.ts->repository.ts"]);
    // Every edge target is a node that exists in the graph.
    const nodeIds = new Set(result.graph.nodes.map((n) => n.id));
    for (const edge of result.graph.edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });

  it("exposes repository meta derived from the fixture path", () => {
    expect(result.meta.rootPath).toBe(path.resolve(FIXTURE_PATH));
    expect(result.meta.name).toBe("pipeline-basic");
  });

  it("returns the AnalyzeRepositoryResult shape with an empty dependency list (no manifests)", () => {
    expect(result).toHaveProperty("graph");
    expect(result).toHaveProperty("repository");
    expect(Array.isArray(result.dependencies)).toBe(true);
    expect(result.dependencies).toHaveLength(0);
  });
});
