// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the 8 convention/usage detectors wired into `arclux doctor`
// in PR #303 (previously they existed but nothing called them — issue #8
// "tests 0%" / KI-009). Each test drives the public detector function
// through hand-built Repository fixtures, matching tests/detector.test.ts.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { detectComponentConvention } from "../packages/detectors/detectComponentConvention";
import { detectFeatureStructure } from "../packages/detectors/detectFeatureStructure";
import { detectMissingExports } from "../packages/detectors/detectMissingExports";
import { detectRepositoryPattern } from "../packages/detectors/detectRepositoryPattern";
import { detectRouteConvention } from "../packages/detectors/detectRouteConvention";
import { detectStoryConvention } from "../packages/detectors/detectStoryConvention";
import { detectTestConvention } from "../packages/detectors/detectTestConvention";
import { detectUnusedFiles } from "../packages/detectors/detectUnusedFiles";
import type { ModuleInfo, RepositoryMeta, FileInfo, RawExport } from "../packages/shared/types";

function makeFile(relativePath: string): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language: "typescript",
    extension: relativePath.endsWith(".tsx") ? ".tsx" : ".ts",
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

interface ModuleOpts {
  exports?: RawExport[];
  imports?: string[];
  resolvedReExports?: Record<string, string>;
  importedBy?: string[];
}

function makeModule(relativePath: string, opts: ModuleOpts = {}): ModuleInfo {
  const imports = opts.imports ?? [];
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports: opts.exports ?? [],
    resolvedReExports: opts.resolvedReExports ?? {},
    importedBy: opts.importedBy ?? [],
    imports,
    resolvedImports: imports,
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

describe("detectComponentConvention", () => {
  it("flags a PascalCase component file that exports neither its own name nor a default", () => {
    const repo = makeRepository([makeModule("src/Button.tsx", { exports: [named("Widget")] })]);
    const findings = detectComponentConvention(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/Button.tsx");
  });

  it("passes a file exporting its own name, a default export, or a framework-convention filename", () => {
    const repo = makeRepository([
      makeModule("src/Button.tsx", { exports: [named("Button")] }),
      makeModule("src/Card.tsx", { exports: [defaultExport("Card")] }),
      makeModule("app/page.tsx", { exports: [named("Page")] }), // Next.js convention file is skipped
    ]);
    expect(detectComponentConvention(repo)).toHaveLength(0);
  });
});

describe("detectRouteConvention", () => {
  it("flags a Next.js page without a default export and a route handler without an HTTP method", () => {
    const repo = makeRepository([
      makeModule("app/page.tsx", { exports: [named("Page")] }),
      makeModule("app/api/users/route.ts", { exports: [named("helper")] }),
    ]);
    const findings = detectRouteConvention(repo);
    expect(findings).toHaveLength(2);
    expect(findings.some((f) => f.filePath === "app/page.tsx")).toBe(true);
    expect(findings.some((f) => f.filePath === "app/api/users/route.ts")).toBe(true);
  });

  it("passes a page with a default export and a route handler with an HTTP-method export", () => {
    const repo = makeRepository([
      makeModule("app/page.tsx", { exports: [defaultExport("Home")] }),
      makeModule("app/api/users/route.ts", { exports: [named("GET")] }),
    ]);
    expect(detectRouteConvention(repo)).toHaveLength(0);
  });
});

describe("detectRepositoryPattern", () => {
  it("flags a package-level circular dependency across two packages", () => {
    const repo = makeRepository([
      makeModule("src/a/x.ts", { imports: ["src/b/y.ts"] }),
      makeModule("src/b/y.ts", { imports: ["src/a/x.ts"] }),
    ]);
    const findings = detectRepositoryPattern(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].cycle).toContain("src/a");
    expect(findings[0].cycle).toContain("src/b");
  });

  it("passes acyclic cross-package imports", () => {
    const repo = makeRepository([
      makeModule("src/a/x.ts", { imports: ["src/b/y.ts"] }),
      makeModule("src/b/y.ts"),
    ]);
    expect(detectRepositoryPattern(repo)).toHaveLength(0);
  });
});

describe("detectMissingExports", () => {
  it("flags a sibling with exports that the folder's index.ts does not re-export", () => {
    const repo = makeRepository([
      makeModule("src/foo/index.ts", { resolvedReExports: { reExported: "src/foo/b.ts" } }),
      makeModule("src/foo/a.ts", { exports: [named("a")] }),
      makeModule("src/foo/b.ts", { exports: [named("reExported")] }),
    ]);
    const findings = detectMissingExports(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/foo/a.ts");
  });

  it("passes when the index re-exports every exporting sibling", () => {
    const repo = makeRepository([
      makeModule("src/foo/index.ts", { resolvedReExports: { a: "src/foo/a.ts" } }),
      makeModule("src/foo/a.ts", { exports: [named("a")] }),
    ]);
    expect(detectMissingExports(repo)).toHaveLength(0);
  });
});

describe("detectFeatureStructure", () => {
  it("flags a feature folder missing its hook and store files", () => {
    const repo = makeRepository([makeModule("src/features/cart/cartLogic.ts")]);
    const findings = detectFeatureStructure(repo);
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.featurePath === "features/cart")).toBe(true);
  });

  it("passes a feature folder with a useXxx hook and an XxxStore", () => {
    const repo = makeRepository([
      makeModule("src/features/cart/useCart.ts"),
      makeModule("src/features/cart/CartStore.ts"),
    ]);
    expect(detectFeatureStructure(repo)).toHaveLength(0);
  });
});

describe("detectStoryConvention", () => {
  it("flags a story file whose component does not exist anywhere", () => {
    const repo = makeRepository([makeModule("src/components/Button.stories.tsx")]);
    const findings = detectStoryConvention(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/components/Button.stories.tsx");
  });

  it("passes a story whose component exists", () => {
    const repo = makeRepository([
      makeModule("src/components/Button.stories.tsx"),
      makeModule("src/components/Button.tsx"),
    ]);
    expect(detectStoryConvention(repo)).toHaveLength(0);
  });
});

describe("detectTestConvention", () => {
  it("flags a test file whose source file does not exist", () => {
    const repo = makeRepository([makeModule("src/utils.test.ts")]);
    const findings = detectTestConvention(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/utils.test.ts");
  });

  it("passes a test whose source file exists", () => {
    const repo = makeRepository([makeModule("src/utils.test.ts"), makeModule("src/utils.ts")]);
    expect(detectTestConvention(repo)).toHaveLength(0);
  });
});

describe("detectUnusedFiles", () => {
  it("flags an orphan that matches no entry-point convention", () => {
    const repo = makeRepository([makeModule("src/dead.ts")]);
    const findings = detectUnusedFiles(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/dead.ts");
  });

  it("does not flag a recognized entry point (apps/cli/index.ts)", () => {
    const repo = makeRepository([makeModule("apps/cli/index.ts")]);
    expect(detectUnusedFiles(repo)).toHaveLength(0);
  });

  it("does not flag a module that something imports", () => {
    const repo = makeRepository([
      makeModule("src/used.ts", { importedBy: ["apps/cli/index.ts"] }),
      makeModule("apps/cli/index.ts"), // orphan, but a recognized entry point
    ]);
    expect(detectUnusedFiles(repo)).toHaveLength(0);
  });
});
