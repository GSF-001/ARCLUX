// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Scoring gate (plan entry "detector quality gate", progres/status-backlog.md
// 2026-08-15 — item 3): ONE registry-driven run that proves every one of the
// 19 detectors can fire on a planted violation AND stays empty on a clean
// fixture. This is deliberately a meta-gate with minimal fixtures — the rich
// per-detector cases live in tests/detector.test.ts / core-detectors.test.ts.
// Keep this registry in sync with those when a detector contract changes.
//
// Target: 19/19 positive, 19/19 negative.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { detectCircularDependency } from "../packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "../packages/detectors/detectUnusedExports";
import { detectOrphanFiles } from "../packages/detectors/detectOrphanFiles";
import { detectDeadCode } from "../packages/detectors/detectDeadCode";
import { detectLargeModules } from "../packages/detectors/detectLargeModules";
import { detectDuplicateModules } from "../packages/detectors/detectDuplicateModules";
import { detectSharedModules } from "../packages/detectors/detectSharedModules";
import { detectIndexFiles } from "../packages/detectors/detectIndexFiles";
import { detectLayerViolation } from "../packages/detectors/detectLayerViolation";
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

type Detector = (repository: Repository) => unknown[];

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

function makeModule(
  relativePath: string,
  opts: {
    exports?: RawExport[];
    imports?: string[];
    resolvedImports?: { moduleId: string; namedImports: string[]; hasDefaultImport: boolean; hasNamespaceImport: boolean; line: number }[];
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
    id: "score-repo",
    org: "test-org",
    name: "score-repo",
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

interface ScoreEntry {
  name: string;
  detector: Detector;
  planted: () => Repository;
  clean: () => Repository;
}

const REGISTRY: ScoreEntry[] = [
  {
    name: "detectCircularDependency",
    detector: detectCircularDependency,
    planted: () =>
      makeRepository([
        makeModule("src/a.ts", { imports: ["src/b.ts"] }),
        makeModule("src/b.ts", { imports: ["src/a.ts"] }),
      ]),
    clean: () =>
      makeRepository([
        makeModule("src/a.ts", { imports: ["src/b.ts"] }),
        makeModule("src/b.ts", { imports: ["src/c.ts"] }),
        makeModule("src/c.ts"),
      ]),
  },
  {
    name: "detectUnusedExports",
    detector: detectUnusedExports,
    planted: () => makeRepository([makeModule("src/single.ts", { exports: [named("lonely")] })]),
    clean: () =>
      makeRepository([
        makeModule("src/single.ts", { exports: [named("used")] }),
        makeModule("src/consumer.ts", {
          imports: ["src/single.ts"],
          resolvedImports: [{ moduleId: "src/single.ts", namedImports: ["used"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
        }),
      ]),
  },
  {
    name: "detectOrphanFiles",
    detector: detectOrphanFiles,
    planted: () => makeRepository([makeModule("src/dead.ts")]),
    clean: () => makeRepository([makeModule("src/used.ts", { importedBy: ["src/main.ts"] })]),
  },
  {
    name: "detectDeadCode",
    detector: detectDeadCode,
    planted: () =>
      makeRepository([
        makeModule("src/setup.ts", { exports: [named("init")], importedBy: ["src/main.ts"] }),
        makeModule("src/main.ts", { imports: ["src/setup.ts"] }),
      ]),
    clean: () =>
      makeRepository([
        makeModule("src/setup.ts", { exports: [named("init")], importedBy: ["src/main.ts"] }),
        makeModule("src/main.ts", {
          imports: ["src/setup.ts"],
          resolvedImports: [{ moduleId: "src/setup.ts", namedImports: ["init"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
        }),
      ]),
  },
  {
    name: "detectLargeModules",
    detector: detectLargeModules,
    planted: () => makeRepository([makeModule("src/huge.ts", { sizeBytes: 20_000 })]),
    clean: () => makeRepository([makeModule("src/small.ts", { sizeBytes: 100 })]),
  },
  {
    name: "detectDuplicateModules",
    detector: detectDuplicateModules,
    planted: () => {
      const repo = makeRepository([
        makeModule("src/a.ts", { sizeBytes: 1000 }),
        makeModule("src/b.ts", { sizeBytes: 1000 }),
      ]);
      repo.getModule("src/b.ts")!.file.hash = repo.getModule("src/a.ts")!.file.hash;
      return repo;
    },
    clean: () =>
      makeRepository([
        makeModule("src/a.ts", { sizeBytes: 1000 }),
        makeModule("src/b.ts", { sizeBytes: 1000 }),
      ]),
  },
  {
    name: "detectSharedModules",
    detector: detectSharedModules,
    planted: () =>
      makeRepository([
        makeModule("src/util.ts", { importedBy: ["m1", "m2", "m3", "m4", "m5", "m6"] }),
      ]),
    clean: () => makeRepository([makeModule("src/util.ts", { importedBy: ["m1"] })]),
  },
  {
    name: "detectIndexFiles",
    detector: detectIndexFiles,
    planted: () =>
      makeRepository([
        makeModule("src/index.ts", { exports: [reExport("a", "src/a.ts"), named("localFn")] }),
      ]),
    clean: () => makeRepository([makeModule("src/notIndex.ts", { exports: [named("x")] })]),
  },
  {
    name: "detectLayerViolation",
    detector: detectLayerViolation,
    planted: () =>
      makeRepository([
        makeModule("packages/foo/index.ts", {
          resolvedImports: [{ moduleId: "apps/web/app/page.tsx", namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 3 }],
        }),
        makeModule("apps/web/app/page.tsx"),
      ]),
    clean: () =>
      makeRepository([
        makeModule("packages/a.ts", {
          resolvedImports: [{ moduleId: "packages/b.ts", namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
        }),
        makeModule("packages/b.ts"),
      ]),
  },
  {
    name: "detectEntryPoints",
    detector: detectEntryPoints,
    planted: () => makeRepository([makeModule("apps/web/app/dashboard/page.tsx")]),
    clean: () => makeRepository([makeModule("src/random.ts")]),
  },
  {
    name: "detectMissingExports",
    detector: detectMissingExports,
    planted: () =>
      makeRepository([
        makeModule("src/index.ts"),
        makeModule("src/helper.ts", { exports: [named("helper")] }),
      ]),
    clean: () =>
      makeRepository([
        makeModule("src/index.ts", { resolvedReExports: { helper: "src/helper.ts" } }),
        makeModule("src/helper.ts", { exports: [named("helper")] }),
      ]),
  },
  {
    name: "detectRouteConvention",
    detector: detectRouteConvention,
    planted: () =>
      makeRepository([makeModule("apps/web/app/dashboard/page.tsx", { exports: [named("metadata")] })]),
    clean: () =>
      makeRepository([makeModule("apps/web/app/dashboard/page.tsx", { exports: [defaultExport("Dashboard")] })]),
  },
  {
    name: "detectComponentConvention",
    detector: detectComponentConvention,
    planted: () =>
      makeRepository([makeModule("src/components/Button.tsx", { exports: [named("Other")] })]),
    clean: () =>
      makeRepository([makeModule("src/components/Button.tsx", { exports: [named("Button")] })]),
  },
  {
    name: "detectFeatureStructure",
    detector: detectFeatureStructure,
    planted: () => makeRepository([makeModule("apps/web/features/impact/useImpact.ts")]),
    clean: () =>
      makeRepository([
        makeModule("apps/web/features/graph/useGraph.ts"),
        makeModule("apps/web/features/graph/GraphStore.ts"),
      ]),
  },
  {
    name: "detectRepositoryPattern",
    detector: detectRepositoryPattern,
    planted: () =>
      makeRepository([
        makeModule("packages/a/x.ts", { imports: ["packages/b/y.ts"] }),
        makeModule("packages/b/y.ts", { imports: ["packages/a/z.ts"] }),
        makeModule("packages/a/z.ts"),
      ]),
    clean: () =>
      makeRepository([
        makeModule("packages/a/x.ts", { imports: ["packages/b/y.ts", "packages/a/z.ts"] }),
        makeModule("packages/b/y.ts"),
        makeModule("packages/a/z.ts"),
      ]),
  },
  {
    name: "detectStoryConvention",
    detector: detectStoryConvention,
    planted: () => makeRepository([makeModule("src/components/Button.stories.tsx")]),
    clean: () =>
      makeRepository([
        makeModule("src/components/Button.tsx"),
        makeModule("src/components/Button.stories.tsx"),
      ]),
  },
  {
    name: "detectTestConvention",
    detector: detectTestConvention,
    planted: () => makeRepository([makeModule("tests/parser/foo.test.ts")]),
    clean: () =>
      makeRepository([
        makeModule("packages/parser/foo.ts"),
        makeModule("tests/parser/foo.test.ts"),
      ]),
  },
  {
    name: "detectUnusedFiles",
    detector: detectUnusedFiles,
    planted: () => makeRepository([makeModule("src/dead.ts")]),
    clean: () => makeRepository([makeModule("src/used.ts", { importedBy: ["src/main.ts"] })]),
  },
  {
    name: "detectAmbiguousSymbolResolution",
    detector: detectAmbiguousSymbolResolution,
    planted: () =>
      makeRepository([
        makeModule("src/symbol_index.ts", { exports: [named("resolveSymbol")] }),
        makeModule("tests/symbol_index.test.ts", { exports: [named("resolveSymbol")] }),
      ]),
    clean: () => makeRepository([makeModule("src/a.ts", { exports: [named("unique")] })]),
  },
];

describe("detector score gate", () => {
  it(`19/19 detectors fire on their planted violation (positive score)`, () => {
    const failures: string[] = [];
    for (const entry of REGISTRY) {
      const findings = entry.detector(entry.planted());
      if (findings.length === 0) failures.push(entry.name);
    }
    const score = REGISTRY.length - failures.length;
    expect(
      failures,
      `positive score: ${score}/${REGISTRY.length} — did NOT fire: ${failures.join(", ")}`
    ).toEqual([]);
  });

  it(`19/19 detectors stay empty on their clean fixture (negative score)`, () => {
    const failures: string[] = [];
    for (const entry of REGISTRY) {
      const findings = entry.detector(entry.clean());
      if (findings.length > 0) failures.push(`${entry.name} (${findings.length} findings)`);
    }
    const score = REGISTRY.length - failures.length;
    expect(
      failures,
      `negative score: ${score}/${REGISTRY.length} — false positives: ${failures.join(", ")}`
    ).toEqual([]);
  });

  it("registry covers all 19 detectors (score denominator is exact)", () => {
    expect(REGISTRY.length).toBe(19);
  });
});
