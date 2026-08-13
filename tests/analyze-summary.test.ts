// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unit tests for the analyze-command detector summary
// (summarizeDetectors in apps/cli/analyze.ts) — the headline counts
// surfaced by `arclux analyze` after the module/graph lines.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { summarizeDetectors } from "../apps/cli/analyze";
import type { ModuleInfo, RepositoryMeta, FileInfo, RawExport } from "../packages/shared/types";

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

function named(name: string, line = 1): RawExport {
  return { name, kind: "named", line };
}

interface ResolvedImport {
  moduleId: string;
  namedImports: string[];
  hasDefaultImport: boolean;
  hasNamespaceImport: boolean;
  line: number;
}

function makeModule(
  relativePath: string,
  exports: RawExport[] = [],
  resolvedImports: ResolvedImport[] = [],
  importedBy: string[] = []
): ModuleInfo {
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports,
    resolvedReExports: {},
    importedBy,
    imports: resolvedImports.map((r) => r.moduleId),
    resolvedImports,
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

describe("summarizeDetectors", () => {
  it("counts a cycle, an unused export and an orphan file", () => {
    // a <-> b form a circular dependency; a exports "used" (imported by b),
    // b exports "used" (imported by a) — both used. orphan.ts exports "dead"
    // which nothing imports and is itself imported by nobody.
    const repo = makeRepository([
      makeModule("src/a.ts", [named("used")], [{ moduleId: "src/b.ts", namedImports: ["used"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }], ["src/b.ts"]),
      makeModule("src/b.ts", [named("used")], [{ moduleId: "src/a.ts", namedImports: ["used"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }], ["src/a.ts"]),
      makeModule("src/orphan.ts", [named("dead")]),
    ]);

    const summary = summarizeDetectors(repo);

    expect(summary.circular).toBe(1);
    expect(summary.unusedExports).toBe(1); // "dead" in orphan.ts
    expect(summary.orphanFiles).toBe(1); // orphan.ts
    expect(summary.layerViolations).toBe(0); // flat fixture matches no layer rule
    expect(summary.total).toBe(3);
  });

  it("returns all zeros for an empty repository", () => {
    const repo = makeRepository([]);
    expect(summarizeDetectors(repo)).toEqual({
      circular: 0,
      unusedExports: 0,
      orphanFiles: 0,
      layerViolations: 0,
      total: 0,
    });
  });
});
