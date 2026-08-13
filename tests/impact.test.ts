// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the impact package's calculateAffectedFiles: consumer tracing
// across the import graph (direct + transitive), distance computation,
// the notFound path, and diamond-shaped graphs (dedup, no double-visit).

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { calculateAffectedFiles } from "../packages/impact/calculateAffectedFiles";
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

/**
 * Builds a chain edge: `from` imports `to` (both sides kept consistent —
 * from.imports gains `to`, to.importedBy gains `from`).
 */
function link(modules: Map<string, ModuleInfo>, from: string, to: string): void {
  const fromMod = modules.get(from)!;
  const toMod = modules.get(to)!;
  fromMod.imports.push(to);
  toMod.importedBy.push(from);
}

function makeChain(...ids: string[]): Repository {
  const modules = new Map<string, ModuleInfo>();
  for (const id of ids) {
    modules.set(id, {
      id,
      file: makeFile(id),
      exports: [],
      resolvedReExports: {},
      importedBy: [],
      imports: [],
      resolvedImports: [],
      implicitDependencies: [],
    });
  }
  for (let i = 0; i < ids.length - 1; i++) {
    link(modules, ids[i], ids[i + 1]);
  }
  const meta: RepositoryMeta = {
    id: "impact-test",
    org: "test-org",
    name: "impact-test",
    defaultBranch: "main",
    rootPath: "/virtual/repo",
    detectedFrameworks: [],
    packageManager: "npm",
    analyzedAt: new Date().toISOString(),
  };
  const repository = new Repository(meta);
  for (const mod of modules.values()) {
    repository.addModule(mod);
  }
  return repository;
}

describe("calculateAffectedFiles", () => {
  it("finds transitive consumers with increasing distance", () => {
    // a -> b -> c  (changing c affects b directly, a transitively)
    const repo = makeChain("a.ts", "b.ts", "c.ts");
    const result = calculateAffectedFiles(repo, "c.ts");

    expect(result.notFound).toBe(false);
    expect(result.totalAffected).toBe(2);
    expect(result.affectedFiles.map((f) => [f.filePath, f.distance])).toEqual([
      ["b.ts", 1],
      ["a.ts", 2],
    ]);
  });

  it("finds only direct consumers when there are no deeper dependents", () => {
    const repo = makeChain("a.ts", "b.ts");
    const result = calculateAffectedFiles(repo, "b.ts");
    expect(result.totalAffected).toBe(1);
    expect(result.affectedFiles[0]).toMatchObject({ filePath: "a.ts", distance: 1 });
  });

  it("does not include the changed module itself", () => {
    const repo = makeChain("a.ts", "b.ts");
    const result = calculateAffectedFiles(repo, "a.ts");
    expect(result.totalAffected).toBe(0);
    expect(result.affectedFiles).toEqual([]);
  });

  it("handles diamond graphs without double-counting", () => {
    // a -> b -> d  and  a -> c -> d : changing d affects b, c (distance 1) and a (distance 2)
    const repo = makeChain("a.ts", "b.ts", "d.ts");
    const c = repo.getModule("c.ts") ?? {
      id: "c.ts",
      file: makeFile("c.ts"),
      exports: [],
      resolvedReExports: {},
      importedBy: [],
      imports: [],
      resolvedImports: [],
      implicitDependencies: [],
    };
    repo.addModule(c);
    link(new Map(repo.getAllModules().map((m) => [m.id, m])), "a.ts", "c.ts");
    link(new Map(repo.getAllModules().map((m) => [m.id, m])), "c.ts", "d.ts");

    const result = calculateAffectedFiles(repo, "d.ts");
    expect(result.totalAffected).toBe(3);
    const byPath = new Map(result.affectedFiles.map((f) => [f.filePath, f.distance]));
    expect(byPath.get("b.ts")).toBe(1);
    expect(byPath.get("c.ts")).toBe(1);
    expect(byPath.get("a.ts")).toBe(2);
  });

  it("reports notFound for a module id that does not exist", () => {
    const repo = makeChain("a.ts", "b.ts");
    const result = calculateAffectedFiles(repo, "missing.ts");
    expect(result.notFound).toBe(true);
    expect(result.totalAffected).toBe(0);
    expect(result.affectedFiles).toEqual([]);
  });
});
