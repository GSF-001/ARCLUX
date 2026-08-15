// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Adversarial edge-case suite (plan entry "detector quality gate",
// progres/status-backlog.md 2026-08-15 — item 2). Two layers:
//   A. Source level: feed hostile/weird Python through parsePython and
//      assert no crash + correct extraction (comments can't create edges,
//      string literals can't create edges, invalid syntax is tolerated).
//   B. Detector level: Repository fixtures attacking detector behavior on
//      edge cases. Where current behavior is arguably wrong (TYPE_CHECKING
//      edges, test-file findings) the test PINS current behavior and marks
//      an OPEN QUESTION — a deliberate behavior change updates the test.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { parsePython } from "../packages/parser/python/parsePython";
import { detectCircularDependency } from "../packages/detectors/detectCircularDependency";
import { detectDeadCode } from "../packages/detectors/detectDeadCode";
import { detectOrphanFiles } from "../packages/detectors/detectOrphanFiles";
import { detectUnusedExports } from "../packages/detectors/detectUnusedExports";
import { isTestFilePath } from "../packages/detectors/testFiles";
import type { FileInfo, ModuleInfo, RepositoryMeta, RawExport, ResolvedImport } from "../packages/shared/types";

function makePyFile(relativePath: string): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language: "python",
    extension: ".py",
    sizeBytes: 100,
    hash: "fake-hash",
  };
}

function named(name: string, line = 1): RawExport {
  return { name, kind: "named", line };
}

function makeModule(
  relativePath: string,
  opts: {
    imports?: string[];
    exports?: RawExport[];
    importedBy?: string[];
    resolvedImports?: ResolvedImport[];
  } = {}
): ModuleInfo {
  const imports = opts.imports ?? [];
  return {
    id: relativePath,
    file: { ...makePyFile(relativePath), language: "typescript", extension: ".ts" },
    exports: opts.exports ?? [],
    resolvedReExports: {},
    importedBy: opts.importedBy ?? [],
    imports,
    resolvedImports:
      opts.resolvedImports ??
      imports.map((moduleId) => ({
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

async function parsePy(source: string, relativePath = "src/mod.py") {
  return parsePython.parse(makePyFile(relativePath), source);
}

describe("adversarial — parsePython (source level)", () => {
  it("minified one-liner does not crash and extracts definitions", async () => {
    const parsed = await parsePy("def A():pass\ndef B():pass\nA();B()");
    expect(parsed.warnings).toEqual([]);
    expect(parsed.imports).toEqual([]);
    expect(parsed.exports.map((e) => e.name)).toEqual(["A", "B"]);
  });

  it("a comment mentioning a cycle cannot create import edges", async () => {
    const parsed = await parsePy(
      "# A calls B, B calls A (this is a comment, not code!)\nimport os"
    );
    // Only the real import is extracted; the cycle-mentioning comment adds
    // nothing to the graph.
    expect(parsed.imports.map((i) => i.source)).toEqual(["os"]);
  });

  it("a string literal containing an import is not an import", async () => {
    const parsed = await parsePy('s = "import os"\ntext = \'from pathlib import Path\'');
    expect(parsed.imports).toEqual([]);
  });

  it("TYPE_CHECKING conditional import is skipped — type-only imports are not edges (decision #458)", async () => {
    const parsed = await parsePy(
      "from typing import TYPE_CHECKING\nif TYPE_CHECKING:\n    from B import something"
    );
    // Decision #458 (Variant A): imports under `if TYPE_CHECKING:` are
    // type-only and must not become dependency-graph edges. Only the
    // `from typing import TYPE_CHECKING` line itself is extracted.
    expect(parsed.imports.map((i) => i.source)).toEqual(["typing"]);
  });

  it("a non-TYPE_CHECKING conditional import is still extracted (guard does not over-skip)", async () => {
    const parsed = await parsePy("if SOME_FLAG:\n    from B import something");
    expect(parsed.imports.map((i) => i.source)).toContain("B");
  });

  it("syntactically invalid source is tolerated (ERROR node) without crashing", async () => {
    const parsed = await parsePy("def (:");
    expect(parsed.imports).toEqual([]);
    expect(parsed.exports).toEqual([]);
  });

  it("empty source parses cleanly", async () => {
    const parsed = await parsePy("");
    expect(parsed.imports).toEqual([]);
    expect(parsed.exports).toEqual([]);
    expect(parsed.warnings).toEqual([]);
  });
});

describe("adversarial — detectCircularDependency", () => {
  it("empty repository does not crash", () => {
    expect(detectCircularDependency(makeRepository([]))).toEqual([]);
  });
});

describe("adversarial — detectDeadCode", () => {
  it("empty repository does not crash", () => {
    expect(detectDeadCode(makeRepository([]))).toEqual([]);
  });

  it("side-effect import with unused exports is flagged; dynamic-call usage is invisible (documented blind spot)", () => {
    // `import "./setup"` with nothing referenced + every export unused =>
    // flagged as dead. detectDeadCode has NO call-extraction pass, so a
    // dynamic usage like getattr(module, "init")() elsewhere cannot
    // protect it. This pins the CURRENT scope boundary (see the
    // detector's header comment) — the finding is accurate within that
    // scope, it just cannot see call-site usage.
    const repo = makeRepository([
      makeModule("src/setup.ts", { exports: [named("init")], importedBy: ["src/main.ts"] }),
      makeModule("src/main.ts", {
        imports: ["src/setup.ts"],
        resolvedImports: [
          { moduleId: "src/setup.ts", kind: "static", namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 1 },
        ],
      }),
    ]);
    const findings = detectDeadCode(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/setup.ts");
  });

  it("namespace import counts as using every export — no false positive", () => {
    const repo = makeRepository([
      makeModule("src/api.ts", { exports: [named("helper")], importedBy: ["src/main.ts"] }),
      makeModule("src/main.ts", {
        imports: ["src/api.ts"],
        resolvedImports: [
          { moduleId: "src/api.ts", kind: "static", namedImports: [], hasDefaultImport: false, hasNamespaceImport: true, line: 1 },
        ],
      }),
    ]);
    expect(detectDeadCode(repo)).toEqual([]);
  });

  it("a test file NOT imported is not dead code and not orphan (decision #459)", () => {
    const repo = makeRepository([makeModule("src/utils.test.ts", { exports: [named("helper")] })]);
    // Decision #459 (Variant A): test files are excluded by convention
    // (runners invoke them by name, like entry points).
    expect(detectDeadCode(repo)).toEqual([]);
    expect(detectOrphanFiles(repo)).toEqual([]);
  });

  it("a test file imported for side effects with unused exports is NOT flagged as dead (decision #459)", () => {
    // e.g. a *.test.ts helper imported for side effects — nothing references
    // its exports, but it's a test-support file, not dead code (runners
    // discover *.test.ts by convention).
    const repo = makeRepository([
      makeModule("src/helpers.test.ts", { exports: [named("install")], importedBy: ["src/main.ts"] }),
      makeModule("src/main.ts", {
        imports: ["src/helpers.test.ts"],
        resolvedImports: [
          { moduleId: "src/helpers.test.ts", kind: "static", namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 1 },
        ],
      }),
    ]);
    expect(detectDeadCode(repo)).toEqual([]);
  });
});

describe("adversarial — detectUnusedExports", () => {
  it("test files with unused exports are not flagged (decision #459)", () => {
    const repo = makeRepository([makeModule("src/utils.test.ts", { exports: [named("helper")] })]);
    expect(detectUnusedExports(repo)).toEqual([]);
  });
});

describe("isTestFilePath", () => {
  it("matches TS/JS test and spec files, not plain sources", () => {
    expect(isTestFilePath("src/utils.test.ts")).toBe(true);
    expect(isTestFilePath("src/Button.spec.tsx")).toBe(true);
    expect(isTestFilePath("src/utils.ts")).toBe(false);
    expect(isTestFilePath("src/Button.tsx")).toBe(false);
  });

  it("matches Python test files and conftest, not plain sources", () => {
    expect(isTestFilePath("tests/test_utils.py")).toBe(true);
    expect(isTestFilePath("src/utils_test.py")).toBe(true);
    expect(isTestFilePath("src/conftest.py")).toBe(true);
    expect(isTestFilePath("src/utils.py")).toBe(false);
  });
});
