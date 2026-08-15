// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Real-mechanics tests for the detectors that previously had only
// placeholder coverage (issue #441). The old suite asserted
// `Array.isArray(findings)` on an EMPTY Repository — a detector returning
// [] for every input would have passed. Each detector below now gets at
// least one positive case (known input -> expected finding with exact
// filePath/detail) and a negative case.
//
// detectCircularDependency / detectUnusedExports / detectOrphanFiles are
// intentionally NOT re-tested here — tests/core-detectors.test.ts already
// covers their mechanics with real fixtures.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { detectLargeModules } from "../packages/detectors/detectLargeModules";
import { detectDuplicateModules } from "../packages/detectors/detectDuplicateModules";
import { detectSharedModules } from "../packages/detectors/detectSharedModules";
import { detectIndexFiles } from "../packages/detectors/detectIndexFiles";
import { detectLayerViolation } from "../packages/detectors/detectLayerViolation";
import { detectDeadCode } from "../packages/detectors/detectDeadCode";
import { detectEntryPoints } from "../packages/detectors/detectEntryPoints";
import { detectMissingExports } from "../packages/detectors/detectMissingExports";
import { detectRouteConvention } from "../packages/detectors/detectRouteConvention";
import { detectComponentConvention } from "../packages/detectors/detectComponentConvention";
import { detectFeatureStructure } from "../packages/detectors/detectFeatureStructure";
import { detectRepositoryPattern } from "../packages/detectors/detectRepositoryPattern";
import { detectStoryConvention } from "../packages/detectors/detectStoryConvention";
import { detectTestConvention } from "../packages/detectors/detectTestConvention";
import { detectUnusedFiles } from "../packages/detectors/detectUnusedFiles";
import { detectAmbiguousSymbolResolution } from "../packages/detectors/detectAmbiguousSymbolResolution";
import type { ModuleInfo, RepositoryMeta, FileInfo, RawExport } from "../packages/shared/types";

function makeFile(relativePath: string, sizeBytes = 100): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language: "typescript",
    extension: ".ts",
    sizeBytes,
    hash: `hash-${relativePath}`,
  };
}

function named(name: string, line = 1): RawExport {
  return { name, kind: "named", line };
}

function defaultExport(name: string, line = 1): RawExport {
  return { name, kind: "default", line };
}

function reExport(name: string, reExportSource: string, line = 1): RawExport {
  return { name, kind: "re-export", reExportSource, line };
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
  opts: {
    exports?: RawExport[];
    imports?: string[];
    resolvedImports?: ResolvedImport[];
    importedBy?: string[];
    resolvedReExports?: Record<string, string>;
    sizeBytes?: number;
  } = {}
): ModuleInfo {
  const imports = opts.imports ?? [];
  return {
    id: relativePath,
    file: makeFile(relativePath, opts.sizeBytes),
    exports: opts.exports ?? [],
    resolvedReExports: opts.resolvedReExports ?? {},
    importedBy: opts.importedBy ?? [],
    imports,
    resolvedImports: (opts.resolvedImports ??
      imports.map((moduleId) => ({
        moduleId,
        namedImports: [],
        hasDefaultImport: false,
        hasNamespaceImport: false,
        line: 1,
      }))).map((r) => ({ ...r, kind: "static" as const })),
    calls: [],
    calledBy: [],
    implicitDependencies: [],
  };
}

function makeRepository(modules: ModuleInfo[]): Repository {
  const meta: RepositoryMeta = {
    id: "detector-test",
    org: "test-org",
    name: "detector-test",
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

describe("detectLargeModules", () => {
  it("flags a module above the size threshold with its byte size", () => {
    const repo = makeRepository([makeModule("src/huge.ts", { sizeBytes: 20_000 })]);
    const findings = detectLargeModules(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/huge.ts");
    expect(findings[0].sizeBytes).toBe(20_000);
  });

  it("leaves small modules alone", () => {
    const repo = makeRepository([makeModule("src/small.ts", { sizeBytes: 100 })]);
    expect(detectLargeModules(repo)).toHaveLength(0);
  });
});

describe("detectDuplicateModules", () => {
  it("groups byte-for-byte identical files by content hash", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { sizeBytes: 1000 }),
      makeModule("src/b.ts", { sizeBytes: 1000 }),
    ]);
    repo.getModule("src/b.ts")!.file.hash = repo.getModule("src/a.ts")!.file.hash;
    const findings = detectDuplicateModules(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePaths.sort()).toEqual(["src/a.ts", "src/b.ts"]);
    expect(findings[0].hash).toBe(repo.getModule("src/a.ts")!.file.hash);
  });

  it("does not group files with different content", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { sizeBytes: 1000 }),
      makeModule("src/b.ts", { sizeBytes: 1000 }),
    ]);
    expect(detectDuplicateModules(repo)).toHaveLength(0);
  });

  it("ignores files under the minimum size (empty stub filter)", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { sizeBytes: 100 }),
      makeModule("src/b.ts", { sizeBytes: 100 }),
    ]);
    repo.getModule("src/b.ts")!.file.hash = repo.getModule("src/a.ts")!.file.hash;
    expect(detectDuplicateModules(repo)).toHaveLength(0);
  });
});

describe("detectSharedModules", () => {
  it("flags modules imported by at least 5 others, sorted by fan-in", () => {
    const repo = makeRepository([
      makeModule("src/util.ts", { importedBy: ["m1", "m2", "m3", "m4", "m5", "m6"] }),
      makeModule("src/less.ts", { importedBy: ["m1", "m2", "m3", "m4", "m5"] }),
    ]);
    const findings = detectSharedModules(repo);
    expect(findings.map((f) => f.filePath)).toEqual(["src/util.ts", "src/less.ts"]);
    expect(findings[0].importerCount).toBe(6);
  });

  it("leaves low fan-in modules alone", () => {
    const repo = makeRepository([makeModule("src/util.ts", { importedBy: ["m1"] })]);
    expect(detectSharedModules(repo)).toHaveLength(0);
  });
});

describe("detectIndexFiles", () => {
  it("classifies a pure barrel file", () => {
    const repo = makeRepository([
      makeModule("src/index.ts", {
        exports: [reExport("a", "src/a.ts"), reExport("b", "src/b.ts")],
      }),
    ]);
    const findings = detectIndexFiles(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/index.ts");
    expect(findings[0].isPureBarrel).toBe(true);
    expect(findings[0].reExportCount).toBe(2);
  });

  it("flags a mixed index.ts (re-exports + its own definitions)", () => {
    const repo = makeRepository([
      makeModule("src/index.ts", {
        exports: [reExport("a", "src/a.ts"), named("localFn")],
      }),
    ]);
    const findings = detectIndexFiles(repo);
    expect(findings[0].isPureBarrel).toBe(false);
    expect(findings[0].totalExportCount).toBe(2);
  });

  it("ignores non-index files", () => {
    const repo = makeRepository([makeModule("src/notIndex.ts", { exports: [named("x")] })]);
    expect(detectIndexFiles(repo)).toHaveLength(0);
  });
});

describe("detectLayerViolation", () => {
  it("flags packages/* importing apps/*", () => {
    const repo = makeRepository([
      makeModule("packages/foo/index.ts", {
        resolvedImports: [{ moduleId: "apps/web/app/page.tsx", namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 3 }],
      }),
      makeModule("apps/web/app/page.tsx", {}),
    ]);
    const findings = detectLayerViolation(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleName).toBe("packages-no-apps-import");
    expect(findings[0].line).toBe(3);
    expect(findings[0].importedFilePath).toBe("apps/web/app/page.tsx");
  });

  it("flags packages/shared/* importing other packages/*", () => {
    const repo = makeRepository([
      makeModule("packages/shared/types.ts", {
        resolvedImports: [{ moduleId: "packages/graph/x.ts", namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
      }),
      makeModule("packages/graph/x.ts", {}),
    ]);
    const findings = detectLayerViolation(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleName).toBe("shared-no-sibling-import");
  });

  it("passes a legitimate packages/* -> packages/* import", () => {
    const repo = makeRepository([
      makeModule("packages/a.ts", {
        resolvedImports: [{ moduleId: "packages/b.ts", namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
      }),
      makeModule("packages/b.ts", {}),
    ]);
    expect(detectLayerViolation(repo)).toHaveLength(0);
  });
});

describe("detectDeadCode", () => {
  it("flags a module imported only for side effects (all exports unused)", () => {
    const repo = makeRepository([
      makeModule("src/setup.ts", { exports: [named("init")], importedBy: ["src/main.ts"] }),
      // main.ts imports setup but references NO named export — side-effect only.
      makeModule("src/main.ts", { imports: ["src/setup.ts"] }),
    ]);
    const findings = detectDeadCode(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/setup.ts");
    expect(findings[0].unusedExportCount).toBe(1);
    expect(findings[0].importedByCount).toBe(1);
  });

  it("passes a module whose export is actually used", () => {
    const repo = makeRepository([
      makeModule("src/setup.ts", { exports: [named("init")], importedBy: ["src/main.ts"] }),
      makeModule("src/main.ts", {
        imports: ["src/setup.ts"],
        resolvedImports: [{ moduleId: "src/setup.ts", namedImports: ["init"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
      }),
    ]);
    expect(detectDeadCode(repo)).toHaveLength(0);
  });
});

describe("detectEntryPoints", () => {
  it("recognizes an orphaned Next.js App Router page as an entry point", () => {
    const repo = makeRepository([makeModule("apps/web/app/dashboard/page.tsx")]);
    const findings = detectEntryPoints(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("apps/web/app/dashboard/page.tsx");
    expect(findings[0].reason).toContain("Next.js App Router");
  });

  it("recognizes the CLI entry file", () => {
    const repo = makeRepository([makeModule("apps/cli/index.ts")]);
    expect(detectEntryPoints(repo).map((f) => f.filePath)).toEqual(["apps/cli/index.ts"]);
  });

  it("does not classify a plain orphaned file as an entry point", () => {
    const repo = makeRepository([makeModule("src/random.ts")]);
    expect(detectEntryPoints(repo)).toHaveLength(0);
  });

  it("ignores convention files that are actually imported", () => {
    const repo = makeRepository([
      makeModule("apps/web/app/dashboard/page.tsx", { importedBy: ["src/x.ts"] }),
    ]);
    expect(detectEntryPoints(repo)).toHaveLength(0);
  });
});

describe("detectMissingExports", () => {
  it("flags a sibling file the folder's index.ts does not re-export", () => {
    const repo = makeRepository([
      makeModule("src/index.ts", {}),
      makeModule("src/helper.ts", { exports: [named("helper")] }),
    ]);
    const findings = detectMissingExports(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].folderPath).toBe("src");
    expect(findings[0].filePath).toBe("src/helper.ts");
  });

  it("passes a sibling that IS re-exported by the index", () => {
    const repo = makeRepository([
      makeModule("src/index.ts", { resolvedReExports: { helper: "src/helper.ts" } }),
      makeModule("src/helper.ts", { exports: [named("helper")] }),
    ]);
    expect(detectMissingExports(repo)).toHaveLength(0);
  });

  it("skips sibling files with nothing to export", () => {
    const repo = makeRepository([
      makeModule("src/index.ts", {}),
      makeModule("src/empty.ts", {}),
    ]);
    expect(detectMissingExports(repo)).toHaveLength(0);
  });
});

describe("detectRouteConvention", () => {
  it("flags a Next.js page without a default export", () => {
    const repo = makeRepository([
      makeModule("apps/web/app/dashboard/page.tsx", { exports: [named("metadata")] }),
    ]);
    const findings = detectRouteConvention(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("apps/web/app/dashboard/page.tsx");
  });

  it("passes a page with a default export", () => {
    const repo = makeRepository([
      makeModule("apps/web/app/dashboard/page.tsx", { exports: [defaultExport("Dashboard")] }),
    ]);
    expect(detectRouteConvention(repo)).toHaveLength(0);
  });

  it("flags a route.ts exporting no HTTP method", () => {
    const repo = makeRepository([makeModule("apps/web/app/api/x/route.ts", { exports: [named("helper")] })]);
    expect(detectRouteConvention(repo)).toHaveLength(1);
  });

  it("passes a route.ts exporting GET", () => {
    const repo = makeRepository([makeModule("apps/web/app/api/x/route.ts", { exports: [named("GET")] })]);
    expect(detectRouteConvention(repo)).toHaveLength(0);
  });
});

describe("detectComponentConvention", () => {
  it("flags a PascalCase .tsx file whose exports don't match its name", () => {
    const repo = makeRepository([
      makeModule("src/components/Button.tsx", { exports: [named("Other")] }),
    ]);
    const findings = detectComponentConvention(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/components/Button.tsx");
  });

  it("passes a component exporting its own name", () => {
    const repo = makeRepository([
      makeModule("src/components/Button.tsx", { exports: [named("Button")] }),
    ]);
    expect(detectComponentConvention(repo)).toHaveLength(0);
  });

  it("passes a component with a default export", () => {
    const repo = makeRepository([
      makeModule("src/components/Button.tsx", { exports: [defaultExport("Anything")] }),
    ]);
    expect(detectComponentConvention(repo)).toHaveLength(0);
  });

  it("skips framework convention files (page.tsx)", () => {
    const repo = makeRepository([
      makeModule("apps/web/app/dashboard/page.tsx", { exports: [named("metadata")] }),
    ]);
    expect(detectComponentConvention(repo)).toHaveLength(0);
  });
});

describe("detectFeatureStructure", () => {
  it("flags a feature folder missing its XxxStore.ts", () => {
    const repo = makeRepository([
      makeModule("apps/web/features/impact/useImpact.ts", {}),
    ]);
    const findings = detectFeatureStructure(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].featurePath).toBe("features/impact");
    expect(findings[0].message).toContain("XxxStore");
  });

  it("flags a feature folder missing its useXxx hook", () => {
    const repo = makeRepository([
      makeModule("apps/web/features/graph/GraphStore.ts", {}),
    ]);
    const findings = detectFeatureStructure(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("useXxx");
  });

  it("passes a feature folder with both hook and store", () => {
    const repo = makeRepository([
      makeModule("apps/web/features/graph/useGraph.ts", {}),
      makeModule("apps/web/features/graph/GraphStore.ts", {}),
    ]);
    expect(detectFeatureStructure(repo)).toHaveLength(0);
  });
});

describe("detectRepositoryPattern", () => {
  it("flags a package-level circular dependency between two packages", () => {
    const repo = makeRepository([
      makeModule("packages/a/x.ts", { imports: ["packages/b/y.ts"] }),
      makeModule("packages/b/y.ts", { imports: ["packages/a/z.ts"] }),
      makeModule("packages/a/z.ts", {}),
    ]);
    const findings = detectRepositoryPattern(repo);
    expect(findings).toHaveLength(1);
    const cycle = findings[0].cycle;
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
    expect(new Set(cycle)).toEqual(new Set(["packages/a", "packages/b"]));
  });

  it("passes acyclic package graphs, ignoring intra-package edges", () => {
    const repo = makeRepository([
      makeModule("packages/a/x.ts", { imports: ["packages/b/y.ts", "packages/a/z.ts"] }),
      makeModule("packages/b/y.ts", {}),
      makeModule("packages/a/z.ts", {}),
    ]);
    expect(detectRepositoryPattern(repo)).toHaveLength(0);
  });
});

describe("detectStoryConvention", () => {
  it("flags a story file whose component does not exist anywhere", () => {
    const repo = makeRepository([makeModule("src/components/Button.stories.tsx", {})]);
    const findings = detectStoryConvention(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/components/Button.stories.tsx");
  });

  it("passes a story whose component exists", () => {
    const repo = makeRepository([
      makeModule("src/components/Button.tsx", {}),
      makeModule("src/components/Button.stories.tsx", {}),
    ]);
    expect(detectStoryConvention(repo)).toHaveLength(0);
  });
});

describe("detectTestConvention", () => {
  it("flags a test file whose source file does not exist", () => {
    const repo = makeRepository([makeModule("tests/parser/foo.test.ts", {})]);
    const findings = detectTestConvention(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("tests/parser/foo.test.ts");
  });

  it("passes a test whose source exists (by basename, any directory)", () => {
    const repo = makeRepository([
      makeModule("packages/parser/foo.ts", {}),
      makeModule("tests/parser/foo.test.ts", {}),
    ]);
    expect(detectTestConvention(repo)).toHaveLength(0);
  });
});

describe("detectUnusedFiles", () => {
  it("flags a file nothing imports", () => {
    const repo = makeRepository([makeModule("src/dead.ts", {})]);
    const findings = detectUnusedFiles(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/dead.ts");
  });

  it("does not flag recognized entry points", () => {
    const repo = makeRepository([makeModule("apps/web/app/dashboard/page.tsx", {})]);
    expect(detectUnusedFiles(repo)).toHaveLength(0);
  });

  it("does not flag imported files (only the true orphan in the chain)", () => {
    const repo = makeRepository([
      makeModule("src/used.ts", { importedBy: ["src/main.ts"] }),
      makeModule("src/main.ts", {}),
    ]);
    const findings = detectUnusedFiles(repo);
    // used.ts is imported -> not flagged; main.ts has no importers and is
    // not an entry point -> the orphan, correctly flagged.
    expect(findings.map((f) => f.filePath)).toEqual(["src/main.ts"]);
  });
});

describe("detectAmbiguousSymbolResolution", () => {
  it("flags a source definition shadowed by a test definition as high severity", () => {
    const repo = makeRepository([
      makeModule("src/symbol_index.ts", { exports: [named("resolveSymbol")] }),
      makeModule("tests/symbol_index.test.ts", { exports: [named("resolveSymbol")] }),
    ]);
    const findings = detectAmbiguousSymbolResolution(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].symbolName).toBe("resolveSymbol");
    expect(findings[0].severity).toBe("high");
  });

  it("flags two source-path definitions as medium severity", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { exports: [named("dup")] }),
      makeModule("src/b.ts", { exports: [named("dup")] }),
    ]);
    const findings = detectAmbiguousSymbolResolution(repo);
    expect(findings[0].severity).toBe("medium");
  });

  it("flags non-source duplicates as low severity", () => {
    const repo = makeRepository([
      makeModule("fixtures/a.ts", { exports: [named("same")] }),
      makeModule("fixtures/b.ts", { exports: [named("same")] }),
    ]);
    const findings = detectAmbiguousSymbolResolution(repo);
    expect(findings[0].severity).toBe("low");
  });

  it("ignores unique export names and re-exports", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { exports: [named("unique"), reExport("b", "src/b.ts")] }),
    ]);
    expect(detectAmbiguousSymbolResolution(repo)).toHaveLength(0);
  });
});
