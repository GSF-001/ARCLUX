// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Real-mechanics tests for packages/editor/ (issue #451): CodeNavigator and
// ImpactNavigator are consumed by the CLI open/edit commands and the
// diagnose command's affected counts, but had zero tests. Both are pure
// Repository logic, so fixtures follow the makeModule/makeRepository
// convention used across tests/.

import { describe, it, expect } from "vitest";
import path from "node:path";
import { Repository } from "../packages/repository/Repository";
import {
  resolveModuleId,
  openFile,
  listDependencyTargets,
  listDirectConsumerTargets,
} from "../packages/editor/CodeNavigator";
import { getImpactCount, getImpactNavigation } from "../packages/editor/ImpactNavigator";
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

function makeModule(relativePath: string, overrides: Partial<ModuleInfo> = {}): ModuleInfo {
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

function makeRepository(modules: ModuleInfo[], rootPath = "/virtual/repo"): Repository {
  const meta: RepositoryMeta = {
    id: "editor-test",
    org: "test-org",
    name: "editor-test",
    defaultBranch: "main",
    rootPath,
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

describe("CodeNavigator — resolveModuleId / openFile", () => {
  const repo = makeRepository(
    [makeModule("src/entry.ts")],
    path.resolve("C:", "virtual", "repo") // Windows-safe fake root for path.relative
  );

  it("normalizes an absolute path to the POSIX module id", () => {
    const absolute = path.join(repo.meta.rootPath, "src", "entry.ts");
    expect(resolveModuleId(repo, absolute)).toBe("src/entry.ts");
  });

  it("openFile returns the module for a tracked path and null for an untracked one", () => {
    const tracked = openFile(repo, path.join(repo.meta.rootPath, "src", "entry.ts"));
    expect(tracked).not.toBeNull();
    expect(tracked!.id).toBe("src/entry.ts");

    const untracked = openFile(repo, path.join(repo.meta.rootPath, "src", "missing.ts"));
    expect(untracked).toBeNull();
  });
});

describe("CodeNavigator — dependency and consumer targets", () => {
  const repo = makeRepository([
    makeModule("entry.ts", {
      resolvedImports: [
        { moduleId: "service.ts", kind: "static", namedImports: ["getService"], hasDefaultImport: false, hasNamespaceImport: false, line: 3 },
        { moduleId: "missing-target.ts", kind: "static", namedImports: [], hasDefaultImport: true, hasNamespaceImport: false, line: 4 },
      ],
    }),
    makeModule("service.ts", { importedBy: ["entry.ts"] }),
  ]);

  it("lists dependency targets from resolved imports, keeping the import line", () => {
    const targets = listDependencyTargets(repo, "entry.ts");
    expect(targets).toEqual([
      { moduleId: "service.ts", filePath: "service.ts", line: 3 },
      // target not in the repository -> filePath falls back to the module id
      { moduleId: "missing-target.ts", filePath: "missing-target.ts", line: 4 },
    ]);
  });

  it("lists direct consumer targets from importedBy", () => {
    const targets = listDirectConsumerTargets(repo, "service.ts");
    expect(targets).toEqual([{ moduleId: "entry.ts", filePath: "entry.ts" }]);
  });

  it("returns [] for an unknown module", () => {
    expect(listDependencyTargets(repo, "ghost.ts")).toEqual([]);
    expect(listDirectConsumerTargets(repo, "ghost.ts")).toEqual([]);
  });
});

describe("ImpactNavigator — getImpactCount / getImpactNavigation", () => {
  const chainRepo = makeRepository([
    makeModule("entry.ts", { imports: ["service.ts"] }),
    makeModule("service.ts", { imports: ["repository.ts"], importedBy: ["entry.ts"] }),
    makeModule("repository.ts", { importedBy: ["service.ts"] }),
  ]);

  it("getImpactCount reports the transitive consumer count", () => {
    expect(getImpactCount(chainRepo, "repository.ts")).toBe(2);
    expect(getImpactCount(chainRepo, "ghost.ts")).toBe(0);
  });

  it("getImpactNavigation returns direct consumers, affected files and the tree", () => {
    const nav = getImpactNavigation(chainRepo, "repository.ts");
    expect(nav.notFound).toBe(false);
    expect(nav.moduleId).toBe("repository.ts");
    expect(nav.directConsumers.map((t) => t.moduleId)).toEqual(["service.ts"]);
    expect(nav.totalAffected).toBe(2);
    expect(nav.affected.map((t) => t.moduleId)).toEqual(["service.ts", "entry.ts"]);
    expect(nav.tree).not.toBeNull();
    expect(nav.tree!.moduleId).toBe("repository.ts");
  });

  it("getImpactNavigation returns notFound for an unknown module", () => {
    const nav = getImpactNavigation(chainRepo, "ghost.ts");
    expect(nav.notFound).toBe(true);
    expect(nav.totalAffected).toBe(0);
    expect(nav.affected).toEqual([]);
    expect(nav.tree).toBeNull();
  });
});
