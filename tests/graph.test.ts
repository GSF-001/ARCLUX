// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for buildDependencyGraph: node/edge construction, import dedup
// (the same module id can appear multiple times in imports[] — the graph
// must emit ONE edge per distinct source->target pair), external imports
// dropped, and implicit (same-scope) dependencies turned into edges.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { buildDependencyGraph } from "../packages/graph/buildDependencyGraph";
import type { ModuleInfo, RepositoryMeta, FileInfo } from "../packages/shared/types";

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
  overrides: Partial<ModuleInfo> = {}
): ModuleInfo {
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports: [],
    resolvedReExports: {},
    importedBy: [],
    imports: [],
    resolvedImports: [],
    implicitDependencies: [],
    ...overrides,
  };
}

function makeRepository(modules: ModuleInfo[]): Repository {
  const meta: RepositoryMeta = {
    id: "graph-test",
    org: "test-org",
    name: "graph-test",
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

describe("buildDependencyGraph", () => {
  it("creates one file node per module and one edge per distinct import pair", () => {
    // A imports B twice (e.g. a value import + a type import) and C once.
    // The graph must render one edge for A->B, not two.
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts", "src/b.ts", "src/c.ts"] }),
      makeModule("src/b.ts", {}),
      makeModule("src/c.ts", {}),
    ]);
    const graph = buildDependencyGraph(repo);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes.every((n) => n.type === "file")).toBe(true);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.some((e) => e.source === "src/a.ts" && e.target === "src/b.ts")).toBe(true);
    expect(graph.edges.some((e) => e.source === "src/a.ts" && e.target === "src/c.ts")).toBe(true);
  });

  it("drops imports that resolve outside the repository (external packages)", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["react", "node:fs"] }),
    ]);
    const graph = buildDependencyGraph(repo);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });

  it("turns implicit same-scope dependencies into edges", () => {
    const repo = makeRepository([
      makeModule("main.go", { implicitDependencies: ["service.go"] }),
      makeModule("service.go", {}),
    ]);
    const graph = buildDependencyGraph(repo);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].type).toBe("import");
    expect(graph.edges[0].source).toBe("main.go");
    expect(graph.edges[0].target).toBe("service.go");
  });

  it("does not duplicate an edge when the dependency is both explicit and implicit", () => {
    const repo = makeRepository([
      makeModule("main.go", { imports: ["service.go"], implicitDependencies: ["service.go"] }),
      makeModule("service.go", {}),
    ]);
    const graph = buildDependencyGraph(repo);
    expect(graph.edges).toHaveLength(1);
  });

  it("labels nodes with the basename and attaches filePath + language metadata", () => {
    const repo = makeRepository([makeModule("src/components/Button.tsx", {})]);
    const graph = buildDependencyGraph(repo);
    const node = graph.nodes[0];
    expect(node.label).toBe("Button.tsx");
    expect(node.filePath).toBe("src/components/Button.tsx");
    expect(node.metadata?.language).toBe("typescript");
  });

  it("carries the repository id into the graph", () => {
    const repo = makeRepository([makeModule("a.ts", {})]);
    const graph = buildDependencyGraph(repo);
    expect(graph.repositoryId).toBe("graph-test");
    expect(typeof graph.builtAt).toBe("string");
  });
});
