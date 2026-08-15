// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// End-to-end test for the Python parser through the REAL pipeline
// (ParserRegistry -> buildIndex -> Repository -> buildDependencyGraph),
// fixing issue #429. The parser previously had only inline-source unit
// tests — never a full analyzeRepository run — and Python relative
// imports (`from .x`, `from ..x`, bare `.`/`..`) silently resolved as
// external, dropping every edge.
//
// Fixture (tests/fixtures/python-basic/):
//   app.py            -> pkg/service.py      (dotted absolute: pkg.service)
//   pkg/service.py    -> pkg/repository.py   (single-dot:   from .repository)
//   pkg/repository.py -> utils.py            (two-dot:      from ..utils)

import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { analyzeRepository, type AnalyzeRepositoryResult } from "../packages/engine/pipeline";

const FIXTURE_PATH = path.join(__dirname, "fixtures", "python-basic");

describe("Python e2e: analyzeRepository on a relative-import fixture (issue #429)", () => {
  let result: AnalyzeRepositoryResult;

  beforeAll(async () => {
    result = await analyzeRepository({ localPath: FIXTURE_PATH });
  }, 30_000);

  it("indexes all 5 fixture modules", () => {
    expect(result.moduleCount).toBe(5);
    const ids = result.repository.getAllModules().map((m) => m.id).sort();
    expect(ids).toEqual([
      "app.py",
      "pkg/__init__.py",
      "pkg/repository.py",
      "pkg/service.py",
      "utils.py",
    ]);
    expect(result.scanSummary.filesScanned).toBe(5);
    expect(result.scanSummary.filesParsed).toBe(5);
    expect(result.scanSummary.filesSkippedNoParser).toBe(0);
  });

  it("resolves all relative-import forms into dependency edges", () => {
    const edges = result.graph.edges.map((e) => `${e.source}->${e.target}`).sort();
    expect(edges).toEqual([
      "app.py->pkg/service.py",
      "pkg/repository.py->utils.py",
      "pkg/service.py->pkg/repository.py",
    ]);
  });

  it("records the resolved imports on the modules themselves", () => {
    const byId = new Map(result.repository.getAllModules().map((m) => [m.id, m]));
    expect(byId.get("pkg/service.py")?.imports).toEqual(["pkg/repository.py"]);
    expect(byId.get("pkg/repository.py")?.imports).toEqual(["utils.py"]);
    expect(byId.get("app.py")?.imports).toEqual(["pkg/service.py"]);
  });
});
