// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for packages/remote:
//  - RemoteRepository argument validation (unit)
//  - createRemoteSnapshot determinism + content (unit + real pipeline run
//    against playground/nextjs-demo — the REAL path, per CONTRIBUTING.md's
//    verification standard: tsc --noEmit is not "verified").

import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { RemoteRepository } from "../packages/remote";
import { createRemoteSnapshot, type RemoteSnapshot } from "../packages/remote";
import type { AnalyzeRepositoryResult } from "../packages/engine/pipeline";

const NEXTJS_DEMO = path.join(__dirname, "..", "playground", "nextjs-demo");

describe("RemoteRepository argument validation", () => {
  it("throws when both url and localPath are set", async () => {
    const repo = new RemoteRepository({
      id: "both",
      url: "https://github.com/GSF-001/ARCLUX.git",
      localPath: "/tmp/x",
    });
    await expect(repo.analyze()).rejects.toThrow(/not both/);
  });

  it("throws when neither url nor localPath is set", async () => {
    const repo = new RemoteRepository({ id: "empty" });
    await expect(repo.analyze()).rejects.toThrow(/required/);
  });

  it("exposes the source unchanged", () => {
    const repo = new RemoteRepository({ id: "r1", localPath: "/tmp/x", branch: "main" });
    expect(repo.source).toEqual({ id: "r1", localPath: "/tmp/x", branch: "main" });
  });
});

describe("createRemoteSnapshot (real pipeline run)", () => {
  let result: AnalyzeRepositoryResult;

  beforeAll(async () => {
    const repo = new RemoteRepository({ id: "nextjs-demo", localPath: NEXTJS_DEMO });
    result = await repo.analyze();
  }, 30_000);

  it("analyzes the fixture through the core engine", () => {
    expect(result.moduleCount).toBeGreaterThan(0);
    expect(result.graph.nodes.length).toBeGreaterThan(0);
    expect(result.graph.edges.length).toBeGreaterThan(0);
  });

  it("produces a deterministic snapshot id for the same source", () => {
    const a = createRemoteSnapshot({ source: { id: "nextjs-demo", localPath: NEXTJS_DEMO }, result });
    const b = createRemoteSnapshot({ source: { id: "nextjs-demo", localPath: NEXTJS_DEMO }, result });
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^snap-[0-9a-f]{12}$/);
  });

  it("carries repository, graph, findings and provenance through", () => {
    const snapshot: RemoteSnapshot = createRemoteSnapshot({
      source: { id: "nextjs-demo", localPath: NEXTJS_DEMO },
      result,
      findings: [],
      provenance: [],
    });
    expect(snapshot.repository).toBe(result.repository);
    expect(snapshot.graph).toBe(result.graph);
    expect(snapshot.findings).toEqual([]);
    expect(snapshot.provenance).toEqual([]);
    expect(new Date(snapshot.createdAt).toISOString()).toBe(snapshot.createdAt);
  });

  it("defaults findings to an empty array when omitted", () => {
    const snapshot = createRemoteSnapshot({ source: { id: "s", localPath: NEXTJS_DEMO }, result });
    expect(snapshot.findings).toEqual([]);
    expect(snapshot.provenance).toBeUndefined();
  });
});
