// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Mutation-style tests for detectCircularDependency (plan entry
// "detector quality gate", progres/status-backlog.md 2026-08-15):
// start from an acyclic graph, plant a cycle by mutating one module's
// imports (the way a real edit would), assert the detector fires with
// the exact node set, then remove the mutation and assert the finding
// clears. Mirrors the makeModule/makeRepository helpers from
// tests/core-detectors.test.ts.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { detectCircularDependency } from "../packages/detectors/detectCircularDependency";
import type { FileInfo, ModuleInfo, RepositoryMeta } from "../packages/shared/types";

function makeFile(relativePath: string): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language: "typescript",
    extension: ".ts",
    sizeBytes: 100,
    hash: "fake-hash",
  };
}

function makeModule(
  relativePath: string,
  opts: { imports?: string[] } = {}
): ModuleInfo {
  const imports = opts.imports ?? [];
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports: [],
    resolvedReExports: {},
    importedBy: [],
    imports,
    resolvedImports: imports.map((moduleId) => ({
      moduleId,
      kind: "static",
      namedImports: [],
      hasDefaultImport: false,
      hasNamespaceImport: false,
      line: 1,
    })),
    calls: [],
    calledBy: [],
    implicitDependencies: [],
  };
}

function makeRepository(modules: ModuleInfo[]): Repository {
  const meta: RepositoryMeta = {
    id: "test-repo",
    org: "test-org",
    name: "test-repo",
    defaultBranch: "main",
    rootPath: "/virtual/repo",
    detectedFrameworks: [],
    packageManager: "npm",
    analyzedAt: new Date().toISOString(),
  };
  const repository = new Repository(meta);
  for (const mod of modules) {
    repository.addModule(mod);
  }
  return repository;
}

/**
 * Applies an edit to one module's imports, mirroring makeModule's
 * resolvedImports derivation, and re-registers it in place (Repository
 * keys modules by id, so addModule overwrites). Fails fast on unknown
 * module ids — a typo must not silently add a phantom module.
 */
function mutateImports(repository: Repository, moduleId: string, imports: string[]): void {
  const existing = repository.getModule(moduleId);
  if (!existing) throw new Error(`mutateImports: unknown module "${moduleId}"`);
  repository.addModule({
    ...existing,
    imports,
    resolvedImports: imports.map((id) => ({
      moduleId: id,
      kind: "static",
      namedImports: [],
      hasDefaultImport: false,
      hasNamespaceImport: false,
      line: 1,
    })),
  });
}

describe("detectCircularDependency — graph mutations", () => {
  it("baseline: acyclic chain has no findings", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/c.ts"] }),
      makeModule("src/c.ts"),
    ]);

    expect(detectCircularDependency(repo)).toEqual([]);
  });

  it("adding edge c->a turns the chain into a cycle with the exact node set", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/c.ts"] }),
      makeModule("src/c.ts"),
    ]);

    mutateImports(repo, "src/c.ts", ["src/a.ts"]);

    const findings = detectCircularDependency(repo);
    expect(findings).toHaveLength(1);
    // Deterministic given insertion order [a, b, c]: DFS finds the cycle
    // starting at a, canonicalizeCycle (issue #207) keeps that rotation.
    expect(findings[0].cycle).toEqual(["src/a.ts", "src/b.ts", "src/c.ts", "src/a.ts"]);
    expect(new Set(findings[0].cycle)).toEqual(new Set(["src/a.ts", "src/b.ts", "src/c.ts"]));
  });

  it("removing the mutation clears the finding (round-trip)", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/c.ts"] }),
      makeModule("src/c.ts"),
    ]);

    mutateImports(repo, "src/c.ts", ["src/a.ts"]);
    expect(detectCircularDependency(repo)).toHaveLength(1);

    mutateImports(repo, "src/c.ts", []);
    expect(detectCircularDependency(repo)).toEqual([]);
  });

  it("adding a forward (non-cycle) edge does not create a finding", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/c.ts"] }),
      makeModule("src/c.ts"),
    ]);

    // a -> b -> c, plus a -> c: still acyclic.
    mutateImports(repo, "src/a.ts", ["src/b.ts", "src/c.ts"]);

    expect(detectCircularDependency(repo)).toEqual([]);
  });

  it("a 2-node cycle planted by mutation reports the pair", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts"),
    ]);

    mutateImports(repo, "src/b.ts", ["src/a.ts"]);

    const findings = detectCircularDependency(repo);
    expect(findings).toHaveLength(1);
    const cycle = findings[0].cycle;
    expect(cycle[0]).toBe(cycle[cycle.length - 1]); // closed loop
    expect(new Set(cycle)).toEqual(new Set(["src/a.ts", "src/b.ts"]));
  });

  it("reports each cycle once regardless of entry-point rotation", () => {
    // Same 3-node cycle, but c is inserted first so DFS enters through it.
    const repo = makeRepository([
      makeModule("src/c.ts", { imports: ["src/a.ts"] }),
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/c.ts"] }),
    ]);

    const findings = detectCircularDependency(repo);
    expect(findings).toHaveLength(1);
    expect(new Set(findings[0].cycle)).toEqual(new Set(["src/a.ts", "src/b.ts", "src/c.ts"]));
  });

  it("a mutation creating a second cycle joins the existing one without key collisions", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/a.ts"] }), // cycle A <-> B
      makeModule("src/c.ts", { imports: ["src/d.ts"] }),
      makeModule("src/d.ts"),
    ]);

    mutateImports(repo, "src/d.ts", ["src/c.ts"]); // cycle C <-> D

    const findings = detectCircularDependency(repo);
    expect(findings).toHaveLength(2);
    const nodeSets = findings.map((f) => new Set(f.cycle));
    expect(nodeSets).toContainEqual(new Set(["src/a.ts", "src/b.ts"]));
    expect(nodeSets).toContainEqual(new Set(["src/c.ts", "src/d.ts"]));
  });

  it("a mutation in an unrelated component leaves the existing finding untouched", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/a.ts"] }), // cycle A <-> B
      makeModule("src/c.ts", { imports: ["src/d.ts"] }),
      makeModule("src/d.ts", { imports: ["src/e.ts"] }),
      makeModule("src/e.ts"),
      makeModule("src/f.ts"), // new file, no imports yet
    ]);

    const before = detectCircularDependency(repo);
    expect(before).toHaveLength(1);

    // f -> e: no path back to f (e imports nothing), so no new cycle.
    mutateImports(repo, "src/f.ts", ["src/e.ts"]);

    const after = detectCircularDependency(repo);
    expect(after).toEqual(before);
    expect(new Set(after[0].cycle)).toEqual(new Set(["src/a.ts", "src/b.ts"]));
  });

  it("self-loop mutation is reported (documents current behavior)", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts"),
    ]);

    mutateImports(repo, "src/b.ts", ["src/b.ts"]);

    const findings = detectCircularDependency(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].cycle).toEqual(["src/b.ts", "src/b.ts"]);
  });

  it("mutating a live repository is equivalent to a fresh index with the same state", () => {
    const mutated = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/c.ts"] }),
      makeModule("src/c.ts"),
    ]);
    mutateImports(mutated, "src/c.ts", ["src/a.ts"]);

    const fresh = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/c.ts"] }),
      makeModule("src/c.ts", { imports: ["src/a.ts"] }),
    ]);

    expect(detectCircularDependency(mutated)).toEqual(detectCircularDependency(fresh));
  });

  it("a mutation leaving one node out of the cycle reports the exact sub-cycle", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/c.ts"] }),
      makeModule("src/c.ts", { imports: ["src/d.ts"] }),
      makeModule("src/d.ts"),
    ]);

    // c now points back to a (cycle a,b,c) and keeps its edge to d — d
    // stays outside the cycle.
    mutateImports(repo, "src/c.ts", ["src/d.ts", "src/a.ts"]);

    const findings = detectCircularDependency(repo);
    expect(findings).toHaveLength(1);
    expect(new Set(findings[0].cycle)).toEqual(new Set(["src/a.ts", "src/b.ts", "src/c.ts"]));
    expect(findings[0].cycle).not.toContain("src/d.ts");
  });
});
