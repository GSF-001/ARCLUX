// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the call graph (issue #50): extractCallsJs (bare-identifier
// call-site extraction for the JS family), buildCallGraph (call edges from
// ModuleInfo.calls), and buildIndex's RawCall -> ResolvedCall resolution +
// calledBy back-fill.

import { describe, it, expect, afterAll } from "vitest";
import ts from "typescript";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Repository } from "../packages/repository/Repository";
import { buildIndex } from "../packages/indexer/buildIndex";
import { buildCallGraph } from "../packages/graph/buildCallGraph";
import { parserRegistry } from "../packages/parser/core/ParserRegistry";
import { parseJs } from "../packages/parser/javascript/parseJs";
import { extractCallsJs } from "../packages/parser/javascript/extractJs";
import { parseTs } from "../packages/parser/typescript/parseTs";
import type { ModuleInfo, RepositoryMeta, FileInfo } from "../packages/shared/types";

parserRegistry.register(parseJs);
parserRegistry.register(parseTs);

// ─────────────────────────────────────────────
// extractCallsJs unit tests
// ─────────────────────────────────────────────

function callsFrom(code: string): { calleeName: string; line: number }[] {
  const sourceFile = ts.createSourceFile(
    "virtual.js",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  return extractCallsJs(sourceFile);
}

describe("extractCallsJs", () => {
  it("matches a bare identifier call with its 1-indexed line", () => {
    expect(callsFrom("foo();")).toEqual([{ calleeName: "foo", line: 1 }]);
    expect(callsFrom("\n\nfoo();")).toEqual([{ calleeName: "foo", line: 3 }]);
    expect(callsFrom("foo(\n  1,\n  2\n);")).toEqual([{ calleeName: "foo", line: 1 }]);
  });

  it("captures multiple bare calls with distinct lines", () => {
    expect(callsFrom("foo();\nbar(1, 2);")).toEqual([
      { calleeName: "foo", line: 1 },
      { calleeName: "bar", line: 2 },
    ]);
  });

  it("excludes obj.foo() — callee is a property access, not a bare identifier", () => {
    expect(callsFrom("obj.foo();")).toEqual([]);
  });

  it("excludes this.foo()", () => {
    expect(callsFrom("this.foo();")).toEqual([]);
  });

  it("excludes require(...) — import-related, already captured as a RawImport", () => {
    expect(callsFrom('require("fs");')).toEqual([]);
  });

  it("excludes foo.bar.baz() — deep property access chain", () => {
    expect(callsFrom("foo.bar.baz();")).toEqual([]);
  });

  it("is wired into parseJs so ParsedFile.calls is populated", async () => {
    const parsed = await parseJs.parse(
      {
        absolutePath: "/virtual/repo/src/app.js",
        relativePath: "src/app.js",
        language: "javascript",
        extension: ".js",
        sizeBytes: 100,
        hash: "fake-hash",
      },
      'import { helper } from "./h";\nhelper();'
    );
    expect(parsed.calls).toEqual([{ calleeName: "helper", line: 2 }]);
  });
});

// ─────────────────────────────────────────────
// buildCallGraph tests (Repository fixture)
// ─────────────────────────────────────────────

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
    calls: [],
    calledBy: [],
    implicitDependencies: [],
    ...overrides,
  };
}

function makeRepository(modules: ModuleInfo[]): Repository {
  const meta: RepositoryMeta = {
    id: "callgraph-test",
    org: "test-org",
    name: "callgraph-test",
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

describe("buildCallGraph", () => {
  it("emits a call edge when a callee resolves to a repo module through namedImports", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", {
        imports: ["src/b.ts"],
        resolvedImports: [
          {
            moduleId: "src/b.ts",
            kind: "static",
            namedImports: ["helper"],
            hasDefaultImport: false,
            hasNamespaceImport: false,
            line: 1,
          },
        ],
        calls: [{ moduleId: "src/b.ts", calleeName: "helper", line: 4 }],
      }),
      makeModule("src/b.ts"),
    ]);
    const graph = buildCallGraph(repo);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      type: "call",
      source: "src/a.ts",
      target: "src/b.ts",
      weight: 1,
    });
  });

  it("weights edges by the number of distinct call sites (callee+line)", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", {
        calls: [
          { moduleId: "src/b.ts", calleeName: "helper", line: 4 },
          { moduleId: "src/b.ts", calleeName: "helper", line: 9 },
          { moduleId: "src/b.ts", calleeName: "other", line: 9 },
        ],
      }),
      makeModule("src/b.ts"),
    ]);
    const graph = buildCallGraph(repo);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].weight).toBe(3);
  });

  it("dedups repeated calls to the same callee on the same line into one call site", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", {
        calls: [
          { moduleId: "src/b.ts", calleeName: "helper", line: 4 },
          { moduleId: "src/b.ts", calleeName: "helper", line: 4 },
        ],
      }),
      makeModule("src/b.ts"),
    ]);
    const graph = buildCallGraph(repo);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].weight).toBe(1);
  });

  it("emits no edge for a call whose target is not a repo module", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", {
        calls: [{ moduleId: "external-pkg", calleeName: "foo", line: 1 }],
      }),
    ]);
    const graph = buildCallGraph(repo);

    expect(graph.edges).toHaveLength(0);
  });

  it("mirrors buildImportGraph's node shape", () => {
    const repo = makeRepository([makeModule("src/utils/format.ts")]);
    const graph = buildCallGraph(repo);

    const node = graph.nodes[0];
    expect(node.id).toBe("src/utils/format.ts");
    expect(node.type).toBe("file");
    expect(node.label).toBe("format.ts");
    expect(node.filePath).toBe("src/utils/format.ts");
    expect(node.metadata?.language).toBe("typescript");
    expect(graph.repositoryId).toBe("callgraph-test");
    expect(typeof graph.builtAt).toBe("string");
  });
});

// ─────────────────────────────────────────────
// buildIndex: RawCall -> ResolvedCall + calledBy back-fill (tmp-dir repos)
// ─────────────────────────────────────────────

const META: Omit<RepositoryMeta, "analyzedAt"> = {
  id: "callgraph-index-test",
  org: "local",
  name: "callgraph-index-test",
  defaultBranch: "local",
  rootPath: "",
  detectedFrameworks: [],
  packageManager: "unknown",
};

function makeRepoDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "arclux-callgraph-"));
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(dir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf-8");
  }
  return dir;
}

const tempDirs: string[] = [];
function track(dir: string): string {
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("buildIndex call resolution", () => {
  it("resolves a bare call through namedImports and back-fills calledBy", async () => {
    const dir = track(
      makeRepoDir({
        "a.js": 'import { helper } from "./b";\nhelper();',
        "b.js": "export function helper() { return 1; }",
      })
    );
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });

    const a = repository.getModule("a.js");
    const b = repository.getModule("b.js");
    expect(a?.calls).toEqual([{ moduleId: "b.js", calleeName: "helper", line: 2 }]);
    expect(b?.calledBy).toEqual(["a.js"]);
  });

  it("resolves bare calls in TypeScript files — TS-only repos now get call edges (issue #316)", async () => {
    const dir = track(
      makeRepoDir({
        "a.ts": 'import { helper } from "./b";\nhelper();',
        "b.ts": "export function helper() { return 1; }",
      })
    );
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });

    const a = repository.getModule("a.ts");
    const b = repository.getModule("b.ts");
    expect(a?.calls).toEqual([{ moduleId: "b.ts", calleeName: "helper", line: 2 }]);
    expect(b?.calledBy).toEqual(["a.ts"]);

    const graph = buildCallGraph(repository);
    expect(graph.edges).toEqual([expect.objectContaining({ type: "call", source: "a.ts", target: "b.ts" })]);
  });

  it("TSX: JSX elements and obj.foo() produce no call edges (issue #316)", async () => {
    const dir = track(
      makeRepoDir({
        "a.tsx":
          'import { helper } from "./b";\nimport type { T } from "./b";\nconst el = <div onClick={handler} />;\nobj.helper();\nhelper();',
        "b.ts": "export function helper() { return 1; }\nexport interface T {}",
      })
    );
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });

    const a = repository.getModule("a.tsx");
    // Only the bare helper() on line 5 resolves — the JSX element, the
    // type-only import, and obj.helper() are all non-call sites.
    expect(a?.calls).toEqual([{ moduleId: "b.ts", calleeName: "helper", line: 5 }]);
  });

  it("drops a bare call whose callee is not among the module's named imports", async () => {
    const dir = track(
      makeRepoDir({
        "a.js": 'import { helper } from "./b";\nmissing();\nhelper();',
        "b.js": "export function helper() { return 1; }",
      })
    );
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });

    const a = repository.getModule("a.js");
    expect(a?.calls).toEqual([{ moduleId: "b.js", calleeName: "helper", line: 3 }]);

    // missing() at line 2 was dropped, so the call graph has one edge
    const graph = buildCallGraph(repository);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ type: "call", source: "a.js", target: "b.js" });
  });

  it("end-to-end: obj.foo() and require() never produce call edges", async () => {
    const dir = track(
      makeRepoDir({
        "a.js": 'import { helper } from "./b";\nconst fs = require("fs");\nobj.helper();\nhelper();',
        "b.js": "export function helper() { return 1; }",
      })
    );
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });

    const a = repository.getModule("a.js");
    // require("fs") at line 2 is an import, obj.helper() at line 3 is a
    // property access — only the bare helper() at line 4 resolves.
    expect(a?.calls).toEqual([{ moduleId: "b.js", calleeName: "helper", line: 4 }]);

    const graph = buildCallGraph(repository);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ type: "call", source: "a.js", target: "b.js" });
  });
});
