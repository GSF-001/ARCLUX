// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Impact analysis tests against a REAL Repository populated with
// ModuleInfo fixtures (same makeModule/makeRepository convention as
// tests/graph.test.ts). Fixes issue #424: the previous version called
// the impact functions with the stale (moduleId, graph) signature on an
// empty Repository — all 6 tests crashed with
// "repository.getModule is not a function" and never exercised the
// actual impact mechanics.
//
// Fixture topology:
//   chain:   entry.ts -> service.ts -> repository.ts
//   circular: a.ts -> b.ts -> c.ts -> a.ts
//   fan-out:  a.ts -> { b.ts, c.ts }

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { calculateAffectedFiles } from "../packages/impact/calculateAffectedFiles";
import { calculateAffectedComponents } from "../packages/impact/calculateAffectedComponents";
import { calculateAffectedModules } from "../packages/impact/calculateAffectedModules";
import { calculateAffectedRoutes } from "../packages/impact/calculateAffectedRoutes";
import { buildImpactTree } from "../packages/impact/buildImpactTree";
import { traceConsumers } from "../packages/impact/traceConsumers";
import { traceDependencies } from "../packages/impact/traceDependencies";
import { traceExports } from "../packages/impact/traceExports";
import { traceImports } from "../packages/impact/traceImports";
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
  for (const mod of modules) {
    repository.addModule(mod);
  }
  return repository;
}

/** entry.ts -> service.ts -> repository.ts (one consumer chain) */
function chainRepository(): Repository {
  return makeRepository([
    makeModule("entry.ts", { imports: ["service.ts"] }),
    makeModule("service.ts", {
      imports: ["repository.ts"],
      importedBy: ["entry.ts"],
    }),
    makeModule("repository.ts", { importedBy: ["service.ts"] }),
  ]);
}

/** a.ts -> b.ts -> c.ts -> a.ts (import cycle back to the start) */
function circularRepository(): Repository {
  return makeRepository([
    makeModule("a.ts", { imports: ["b.ts"], importedBy: ["c.ts"] }),
    makeModule("b.ts", { imports: ["c.ts"], importedBy: ["a.ts"] }),
    makeModule("c.ts", { imports: ["a.ts"], importedBy: ["b.ts"] }),
  ]);
}

/** a.ts -> b.ts and a.ts -> c.ts (one importer, two dependencies) */
function fanOutRepository(): Repository {
  return makeRepository([
    makeModule("a.ts", { imports: ["b.ts", "c.ts"] }),
    makeModule("b.ts", { importedBy: ["a.ts"] }),
    makeModule("c.ts", { importedBy: ["a.ts"] }),
  ]);
}

describe("Impact Analysis — traceConsumers", () => {
  it("returns direct and transitive consumers along the chain", () => {
    const trace = traceConsumers(chainRepository(), "repository.ts");
    expect(trace.notFound).toBe(false);
    expect(trace.direct).toEqual(["service.ts"]);
    // BFS order: service (direct) first, then entry.
    expect(trace.transitive).toEqual(["service.ts", "entry.ts"]);
  });

  it("returns notFound for a module that does not exist", () => {
    const trace = traceConsumers(chainRepository(), "ghost.ts");
    expect(trace).toEqual({ direct: [], transitive: [], notFound: true });
  });

  it("terminates on circular import chains", () => {
    const trace = traceConsumers(circularRepository(), "a.ts");
    // c.ts imports a.ts; b.ts imports c.ts; a.ts imports b.ts (visited).
    expect(trace.direct).toEqual(["c.ts"]);
    expect(trace.transitive).toEqual(["c.ts", "b.ts"]);
  });
});

describe("Impact Analysis — traceDependencies", () => {
  it("returns direct and transitive dependencies along the chain", () => {
    const trace = traceDependencies(chainRepository(), "entry.ts");
    expect(trace.notFound).toBe(false);
    expect(trace.direct).toEqual(["service.ts"]);
    expect(trace.transitive).toEqual(["service.ts", "repository.ts"]);
  });

  it("returns all fan-out targets for one importer", () => {
    const trace = traceDependencies(fanOutRepository(), "a.ts");
    expect(trace.direct).toEqual(["b.ts", "c.ts"]);
    expect(trace.transitive).toEqual(["b.ts", "c.ts"]);
  });

  it("returns notFound for a module that does not exist", () => {
    const trace = traceDependencies(chainRepository(), "ghost.ts");
    expect(trace).toEqual({ direct: [], transitive: [], notFound: true });
  });
});

describe("Impact Analysis — calculateAffectedFiles", () => {
  it("reports consumers of the changed module with correct distances", () => {
    // Change repository.ts -> service.ts (distance 1) and entry.ts (distance 2).
    const impact = calculateAffectedFiles(chainRepository(), "repository.ts");
    expect(impact.notFound).toBe(false);
    expect(impact.changedModuleId).toBe("repository.ts");
    expect(impact.totalAffected).toBe(2);
    expect(impact.affectedFiles).toEqual([
      { moduleId: "service.ts", filePath: "service.ts", distance: 1 },
      { moduleId: "entry.ts", filePath: "entry.ts", distance: 2 },
    ]);
  });

  it("reports the single direct consumer in a fan-out", () => {
    const impact = calculateAffectedFiles(fanOutRepository(), "b.ts");
    expect(impact.notFound).toBe(false);
    expect(impact.totalAffected).toBe(1);
    expect(impact.affectedFiles).toEqual([
      { moduleId: "a.ts", filePath: "a.ts", distance: 1 },
    ]);
  });

  it("returns empty result with notFound for a missing module", () => {
    const impact = calculateAffectedFiles(chainRepository(), "ghost.ts");
    expect(impact.notFound).toBe(true);
    expect(impact.totalAffected).toBe(0);
    expect(impact.affectedFiles).toEqual([]);
  });
});

describe("Impact Analysis — buildImpactTree", () => {
  it("builds a nested tree of consumers", () => {
    const tree = buildImpactTree(chainRepository(), "repository.ts");
    expect(tree).not.toBeNull();
    expect(tree!.moduleId).toBe("repository.ts");
    expect(tree!.children.map((n) => n.moduleId)).toEqual(["service.ts"]);
    const service = tree!.children[0];
    expect(service.children.map((n) => n.moduleId)).toEqual(["entry.ts"]);
  });

  it("does not recurse forever on circular import chains", () => {
    const tree = buildImpactTree(circularRepository(), "a.ts");
    expect(tree).not.toBeNull();
    expect(tree!.moduleId).toBe("a.ts");
    // The tree walks UP consumers: a.ts is imported by c.ts, c.ts by b.ts,
    // and b.ts's consumer a.ts is an ancestor — the cycle must be cut there.
    expect(tree!.children.map((n) => n.moduleId)).toEqual(["c.ts"]);
    const c = tree!.children[0];
    expect(c.children.map((n) => n.moduleId)).toEqual(["b.ts"]);
    expect(c.children[0].children).toEqual([]);
  });

  it("returns null for a module that does not exist", () => {
    expect(buildImpactTree(chainRepository(), "ghost.ts")).toBeNull();
  });
});

describe("Impact Analysis — traceExports", () => {
  it("attributes importers by named, default and namespace usage", () => {
    const repo = makeRepository([
      makeModule("lib.ts", {
        exports: [
          { name: "helper", kind: "named", line: 5 },
          { name: "Widget", kind: "default", line: 10 },
        ],
      }),
      makeModule("consumerA.ts", {
        resolvedImports: [
          { moduleId: "lib.ts", kind: "static", namedImports: ["helper"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 },
        ],
      }),
      makeModule("consumerB.ts", {
        resolvedImports: [
          { moduleId: "lib.ts", kind: "static", namedImports: [], hasDefaultImport: true, hasNamespaceImport: false, line: 1 },
        ],
      }),
      makeModule("consumerNs.ts", {
        resolvedImports: [
          { moduleId: "lib.ts", kind: "static", namedImports: [], hasDefaultImport: false, hasNamespaceImport: true, line: 1 },
        ],
      }),
    ]);

    const entries = traceExports(repo, "lib.ts");
    expect(entries).toHaveLength(2);

    const helper = entries.find((e) => e.exportName === "helper")!;
    expect(helper.exportKind).toBe("named");
    expect(helper.line).toBe(5);
    // named usage + namespace import both pull the export in
    expect(helper.importedByModuleIds.sort()).toEqual(["consumerA.ts", "consumerNs.ts"]);

    const widget = entries.find((e) => e.exportName === "Widget")!;
    expect(widget.importedByModuleIds.sort()).toEqual(["consumerB.ts", "consumerNs.ts"]);
  });

  it("skips re-export attribution and returns [] for a missing module", () => {
    const repo = makeRepository([
      makeModule("lib.ts", {
        exports: [{ name: "a", kind: "re-export", reExportSource: "./a", line: 1 }],
      }),
      makeModule("consumer.ts", {
        resolvedImports: [
          { moduleId: "lib.ts", kind: "static", namedImports: ["a"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 },
        ],
      }),
    ]);
    const entries = traceExports(repo, "lib.ts");
    expect(entries).toHaveLength(1);
    // re-exports forward a symbol from elsewhere — never attributed to this module
    expect(entries[0].importedByModuleIds).toEqual([]);
    expect(traceExports(repo, "ghost.ts")).toEqual([]);
  });
});

describe("Impact Analysis — traceImports", () => {
  it("assembles identifiers (named + default + namespace) from resolved imports", () => {
    const repo = makeRepository([
      makeModule("entry.ts", {
        resolvedImports: [
          { moduleId: "service.ts", kind: "static", namedImports: ["getService", "config"], hasDefaultImport: false, hasNamespaceImport: false, line: 3 },
          { moduleId: "utils.ts", kind: "static", namedImports: [], hasDefaultImport: true, hasNamespaceImport: false, line: 4 },
          { moduleId: "types.ts", kind: "static", namedImports: [], hasDefaultImport: false, hasNamespaceImport: true, line: 5 },
        ],
      }),
    ]);

    expect(traceImports(repo, "entry.ts")).toEqual([
      { fromModuleId: "service.ts", identifiers: ["getService", "config"], line: 3 },
      { fromModuleId: "utils.ts", identifiers: ["default"], line: 4 },
      { fromModuleId: "types.ts", identifiers: ["*"], line: 5 },
    ]);
  });

  it("returns [] for a missing module", () => {
    expect(traceImports(chainRepository(), "ghost.ts")).toEqual([]);
  });
});

describe("Impact Analysis — calculateAffectedComponents", () => {
  it("filters affected files to PascalCase .tsx/.jsx components only", () => {
    const repo = makeRepository([
      makeModule("repository.ts", { importedBy: ["Button.tsx", "service.ts"] }),
      makeModule("Button.tsx", { imports: ["repository.ts"] }),
      makeModule("service.ts", { imports: ["repository.ts"] }),
    ]);

    const components = calculateAffectedComponents(repo, "repository.ts");
    expect(components.map((c) => c.moduleId)).toEqual(["Button.tsx"]);
    expect(components[0].filePath).toBe("Button.tsx");
  });

  it("returns [] when no affected file is a component", () => {
    const repo = makeRepository([
      makeModule("repository.ts", { importedBy: ["service.ts"] }),
      makeModule("service.ts", { imports: ["repository.ts"] }),
    ]);
    expect(calculateAffectedComponents(repo, "repository.ts")).toEqual([]);
  });
});

describe("Impact Analysis — calculateAffectedModules", () => {
  it("groups affected files by first-two-path-segments package, sorted by count desc", () => {
    const repo = makeRepository([
      makeModule("packages/web/entry.ts", { imports: ["packages/web/service.ts"] }),
      makeModule("packages/web/service.ts", { imports: ["packages/core/repository.ts"], importedBy: ["packages/web/entry.ts"] }),
      makeModule("packages/core/repository.ts", { importedBy: ["packages/web/service.ts"] }),
    ]);

    const groups = calculateAffectedModules(repo, "packages/core/repository.ts");
    expect(groups).toEqual([
      { packageId: "packages/web", fileCount: 2, filePaths: ["packages/web/service.ts", "packages/web/entry.ts"] },
    ]);
  });

  it("spreads affected files across packages when the chain crosses them", () => {
    const repo = makeRepository([
      makeModule("packages/web/page.tsx", { imports: ["packages/core/hook.ts"], importedBy: [] }),
      makeModule("packages/core/hook.ts", { imports: ["packages/core/lib.ts"], importedBy: ["packages/web/page.tsx"] }),
      makeModule("packages/core/lib.ts", { importedBy: ["packages/core/hook.ts"] }),
    ]);

    const groups = calculateAffectedModules(repo, "packages/core/lib.ts");
    // affected: packages/core/hook.ts (dist 1) and packages/web/page.tsx (dist 2)
    expect(groups).toEqual([
      { packageId: "packages/core", fileCount: 1, filePaths: ["packages/core/hook.ts"] },
      { packageId: "packages/web", fileCount: 1, filePaths: ["packages/web/page.tsx"] },
    ]);
  });
});

describe("Impact Analysis — calculateAffectedRoutes", () => {
  it("maps affected page/route files to route paths, stripping route-group segments", () => {
    const repo = makeRepository([
      makeModule("data.ts", {
        importedBy: ["app/dashboard/page.tsx", "app/(auth)/login/page.tsx", "app/api/users/route.ts"],
      }),
      makeModule("app/dashboard/page.tsx", { imports: ["data.ts"] }),
      makeModule("app/(auth)/login/page.tsx", { imports: ["data.ts"] }),
      makeModule("app/api/users/route.ts", { imports: ["data.ts"] }),
    ]);

    const routes = calculateAffectedRoutes(repo, "data.ts");
    expect(routes.map((r) => r.routePath).sort()).toEqual(["/api/users", "/dashboard", "/login"]);
    // non-page/route affected files are dropped entirely
    expect(routes.every((r) => /\/(page|route)\./.test(r.filePath))).toBe(true);
  });

  it("returns [] when no affected file is a page or route", () => {
    const repo = chainRepository();
    expect(calculateAffectedRoutes(repo, "repository.ts")).toEqual([]);
  });
});
