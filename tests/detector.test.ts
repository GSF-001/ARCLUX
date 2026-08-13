// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { detectAmbiguousSymbolResolution } from "../packages/detectors/detectAmbiguousSymbolResolution";
import type { ModuleInfo, RepositoryMeta, FileInfo, RawExport } from "../packages/shared/types";

/**
 * First test file in the project. Covers the two categorize() edge cases
 * ManSio flagged on issue GSF-001/ARCLUX#182's follow-up comment:
 *   1. "TEST/foo.ts" (uppercase dir) was previously never matched -- category
 *      checks were case-sensitive.
 *   2. "src-test/utils.ts" was previously misclassified because the checks
 *      were plain substring matches with no path-segment boundary awareness.
 *
 * Both are tested indirectly through the public detectAmbiguousSymbolResolution
 * function (categorize() itself isn't exported), by asserting on the
 * resulting finding's severity and per-definition category -- this matches
 * what an actual caller of the detector would observe, not just an internal
 * implementation detail.
 */

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

function makeModule(relativePath: string, exportName: string, line = 1): ModuleInfo {
  const exp: RawExport = { name: exportName, kind: "named", line };
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports: [exp],
    resolvedReExports: {},
    importedBy: [],
    imports: [],
    resolvedImports: [],
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

describe("detectAmbiguousSymbolResolution / categorize()", () => {
  it("matches test directories case-insensitively (uppercase TEST/ dir)", () => {
    const repository = makeRepository([
      makeModule("src/foo.ts", "foo"),
      makeModule("TEST/foo.ts", "foo"),
    ]);

    const findings = detectAmbiguousSymbolResolution(repository);

    expect(findings).toHaveLength(1);
    expect(findings[0].symbolName).toBe("foo");
    expect(findings[0].severity).toBe("high");
    const testDef = findings[0].definitions.find((d) => d.modulePath === "TEST/foo.ts");
    expect(testDef?.category).toBe("test");
  });

  it("does not treat 'src-test' as a match for the 'test' or 'source' segment (path-segment boundary, not substring)", () => {
    const repository = makeRepository([
      makeModule("src/bar.ts", "bar"),
      makeModule("src-test/bar.ts", "bar"),
    ]);

    const findings = detectAmbiguousSymbolResolution(repository);

    expect(findings).toHaveLength(1);
    expect(findings[0].symbolName).toBe("bar");

    const srcTestDef = findings[0].definitions.find((d) => d.modulePath === "src-test/bar.ts");
    expect(srcTestDef?.category).not.toBe("source");
    expect(srcTestDef?.category).not.toBe("test");
    expect(findings[0].severity).toBe("high");
  });

  it("does not flag symbols with only one definition", () => {
    const repository = makeRepository([makeModule("src/only.ts", "onlyOne")]);
    const findings = detectAmbiguousSymbolResolution(repository);
    expect(findings).toHaveLength(0);
  });

  it("skips re-exports -- they forward a definition, not create one", () => {
    const reExport: RawExport = {
      name: "shared",
      kind: "re-export",
      reExportSource: "./origin",
      line: 1,
    };
    const barrel: ModuleInfo = {
      id: "src/index.ts",
      file: makeFile("src/index.ts"),
      exports: [reExport],
      resolvedReExports: { shared: "src/origin.ts" },
      importedBy: [],
      imports: [],
      resolvedImports: [],
      implicitDependencies: [],
    };
    const origin = makeModule("src/origin.ts", "shared");

    const repository = makeRepository([barrel, origin]);
    const findings = detectAmbiguousSymbolResolution(repository);

    expect(findings).toHaveLength(0);
  });
});
