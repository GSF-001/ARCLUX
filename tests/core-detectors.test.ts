// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Coverage for the two core detectors that gate `arclux verify`'s verdict
// and feed the new analyze summary: detectCircularDependency and
// detectUnusedExports (issue #8 / KI-009 round 2).

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { detectCircularDependency } from "../packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "../packages/detectors/detectUnusedExports";
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

function defaultExport(name: string, line = 1): RawExport {
  return { name, kind: "default", line };
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
  opts: { exports?: RawExport[]; imports?: string[]; resolvedImports?: ResolvedImport[]; importedBy?: string[] } = {}
): ModuleInfo {
  const imports = opts.imports ?? [];
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports: opts.exports ?? [],
    resolvedReExports: {},
    importedBy: opts.importedBy ?? [],
    imports,
    resolvedImports: opts.resolvedImports ?? imports.map((moduleId) => ({ moduleId, namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 1 })),
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

describe("detectCircularDependency", () => {
  it("flags a 3-module import cycle with the full cycle path", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/c.ts"] }),
      makeModule("src/c.ts", { imports: ["src/a.ts"] }),
    ]);

    const findings = detectCircularDependency(repo);

    expect(findings).toHaveLength(1);
    const cycle = findings[0].cycle;
    expect(cycle[0]).toBe(cycle[cycle.length - 1]); // closed loop
    expect(new Set(cycle)).toEqual(new Set(["src/a.ts", "src/b.ts", "src/c.ts"]));
  });

  it("passes an acyclic dependency chain", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/c.ts"] }),
      makeModule("src/c.ts"),
    ]);
    expect(detectCircularDependency(repo)).toHaveLength(0);
  });
});

describe("detectUnusedExports", () => {
  it("flags a named export that no module imports", () => {
    const repo = makeRepository([makeModule("src/single.ts", { exports: [named("lonely")] })]);
    const findings = detectUnusedExports(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/single.ts");
    expect(findings[0].exportName).toBe("lonely");
  });

  it("does not flag a named export imported by another module", () => {
    const repo = makeRepository([
      makeModule("src/single.ts", { exports: [named("used")] }),
      makeModule("src/consumer.ts", {
        imports: ["src/single.ts"],
        resolvedImports: [{ moduleId: "src/single.ts", namedImports: ["used"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
      }),
    ]);
    expect(detectUnusedExports(repo)).toHaveLength(0);
  });

  it("does not flag a default export imported via default import", () => {
    const repo = makeRepository([
      makeModule("src/single.ts", { exports: [defaultExport("Widget")] }),
      makeModule("src/consumer.ts", {
        imports: ["src/single.ts"],
        resolvedImports: [{ moduleId: "src/single.ts", namedImports: [], hasDefaultImport: true, hasNamespaceImport: false, line: 1 }],
      }),
    ]);
    expect(detectUnusedExports(repo)).toHaveLength(0);
  });

  it("flags a default export that nothing imports", () => {
    const repo = makeRepository([makeModule("src/single.ts", { exports: [defaultExport("Widget")] })]);
    const findings = detectUnusedExports(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].exportKind).toBe("default");
  });
});
