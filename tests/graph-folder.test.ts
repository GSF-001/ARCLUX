// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for buildFolderGraph + folderGraphToJSON (BUG-1): d3-hierarchy
// HierarchyNode carries parent pointers, so JSON.stringify of the raw
// result throws "Converting circular structure to JSON" — which killed
// the folder_graph MCP tool on every repo. The JSON view must always
// stringify; stats must match the tree.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import {
  buildFolderGraph,
  folderGraphToJSON,
} from "../packages/graph/buildFolderGraph";
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

function makeModule(relativePath: string): ModuleInfo {
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports: [],
    resolvedReExports: {},
    importedBy: [],
    imports: [],
    resolvedImports: [],
    calls: [],
    calledBy: [],
    implicitDependencies: [],
  };
}

function makeRepository(paths: string[]): Repository {
  const meta: RepositoryMeta = {
    id: "folder-test",
    org: "test-org",
    name: "folder-test",
    defaultBranch: "main",
    rootPath: "/virtual/repo",
    detectedFrameworks: [],
    packageManager: "npm",
    analyzedAt: new Date().toISOString(),
  };
  const repository = new Repository(meta);
  for (const p of paths) repository.addModule(makeModule(p));
  return repository;
}

describe("folderGraphToJSON (BUG-1)", () => {
  it("raw buildFolderGraph result is NOT JSON-safe (documents the d3 parent-pointer trap)", () => {
    const repo = makeRepository(["a.ts", "sub/b.ts"]);
    const raw = buildFolderGraph(repo);
    expect(() => JSON.stringify(raw)).toThrow(/circular/);
  });

  it("JSON view stringifies, round-trips, and carries tree + folders + stats", () => {
    const repo = makeRepository(["a.ts", "sub/b.ts", "sub/deep/c.ts"]);
    const view = folderGraphToJSON(buildFolderGraph(repo));
    const text = JSON.stringify(view); // must not throw (was the MCP crash)
    const back = JSON.parse(text);
    expect(back.tree.children.map((c: { name: string }) => c.name).sort()).toEqual(["a.ts", "sub"]);
    expect(back.folders.map((f: { path: string }) => f.path).sort()).toEqual(["", "sub", "sub/deep"]);
    expect(back.stats).toEqual({ depth: 3, nodeCount: 6, fileCount: 3, folderCount: 3 });
  });

  it("folders list direct fileIds and childFolderPaths (not nested)", () => {
    const repo = makeRepository(["a.ts", "sub/b.ts", "sub/deep/c.ts"]);
    const view = folderGraphToJSON(buildFolderGraph(repo));
    const byPath = new Map(view.folders.map((f) => [f.path, f]));
    expect(byPath.get("")?.fileIds).toEqual(["a.ts"]);
    expect(byPath.get("")?.childFolderPaths).toEqual(["sub"]);
    expect(byPath.get("sub")?.fileIds).toEqual(["sub/b.ts"]);
    expect(byPath.get("sub")?.childFolderPaths).toEqual(["sub/deep"]);
    expect(byPath.get("sub/deep")?.fileIds).toEqual(["sub/deep/c.ts"]);
  });
});
