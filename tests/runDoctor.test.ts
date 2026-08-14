// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for packages/engine/runDoctor.ts — the normalized 19-detector
// suite that powers POST /api/doctor (HTTP counterpart of `arclux doctor`).

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { runDoctor, safeRun } from "../packages/engine/runDoctor";
import type { DoctorFinding } from "../packages/engine/runDoctor";
import type { ModuleInfo, RepositoryMeta, FileInfo, RawExport } from "../packages/shared/types";

function makeFile(relativePath: string, language = "typescript"): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language,
    extension: language === "javascript" ? ".js" : ".ts",
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
  opts: { exports?: RawExport[]; imports?: string[]; resolvedImports?: ResolvedImport[] } = {}
): ModuleInfo {
  const imports = opts.imports ?? [];
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports: opts.exports ?? [],
    resolvedReExports: {},
    importedBy: [],
    imports,
    resolvedImports: opts.resolvedImports ?? imports.map((moduleId) => ({ moduleId, namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 1 })),
    calls: [],
    calledBy: [],
    implicitDependencies: [],
  };
}

function makeRepository(modules: ModuleInfo[]): Repository {
  const meta: RepositoryMeta = {
    id: "doctor-test",
    org: "test-org",
    name: "doctor-test",
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

describe("runDoctor", () => {
  it("flags an unused export as an error with checkId + filePath", () => {
    const repo = makeRepository([makeModule("src/lonely.ts", { exports: [named("lonely")] })]);
    const result = runDoctor(repo);

    const finding = result.findings.find((f) => f.checkId === "unusedExports");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("error");
    expect(finding?.filePath).toBe("src/lonely.ts");
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
  });

  it("flags a 2-module import cycle as circularDependency", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { imports: ["src/b.ts"] }),
      makeModule("src/b.ts", { imports: ["src/a.ts"] }),
    ]);
    const result = runDoctor(repo);

    const finding = result.findings.find((f) => f.checkId === "circularDependency");
    expect(finding?.severity).toBe("error");
    expect(finding?.message).toContain("src/a.ts");
    expect(finding?.message).toContain("src/b.ts");
  });

  it("flags an orphan file as an error", () => {
    const repo = makeRepository([makeModule("src/orphan.ts")]);
    const result = runDoctor(repo);

    const finding = result.findings.find((f) => f.checkId === "orphanFiles");
    expect(finding?.severity).toBe("error");
    expect(finding?.filePath).toBe("src/orphan.ts");
  });

  it("lists entry points as info, not error", () => {
    const repo = makeRepository([makeModule("apps/cli/index.ts")]);
    const result = runDoctor(repo);

    const finding = result.findings.find((f) => f.checkId === "entryPoints");
    expect(finding?.severity).toBe("info");
    // entry points are NOT flagged as orphan errors (entry-file filtering)
    expect(result.findings.some((f) => f.checkId === "orphanFiles")).toBe(false);
  });

  it("returns no error/warning findings for a fully-referenced chain (entry point root)", () => {
    const repo = makeRepository([
      makeModule("apps/cli/index.ts", {
        imports: ["src/consumer.ts"],
        resolvedImports: [{ moduleId: "src/consumer.ts", namedImports: ["consumer"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
      }),
      makeModule("src/consumer.ts", {
        imports: ["src/used.ts"],
        resolvedImports: [{ moduleId: "src/used.ts", namedImports: ["helper"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
      }),
      makeModule("src/used.ts", { exports: [named("helper")] }),
    ]);
    // buildIndex back-fills importedBy; the fixture must too — otherwise
    // findModulesWithNoImporters flags everything as orphan.
    const modules = repo.getAllModules();
    modules[0].importedBy = []; // entry point: nothing imports the CLI
    modules[1].importedBy = ["apps/cli/index.ts"];
    modules[2].importedBy = ["src/consumer.ts"];

    const result = runDoctor(repo);
    // Only the informational entryPoints finding may remain — no errors/warnings.
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it("computes severity counts that sum to findings length", () => {
    const repo = makeRepository([
      makeModule("src/lonely.ts", { exports: [named("lonely")] }),
      makeModule("src/orphan.ts"),
    ]);
    const result = runDoctor(repo);
    expect(result.errorCount + result.warningCount + result.infoCount).toBe(result.findings.length);
  });

  it("safeRun surfaces a detector crash as a finding instead of throwing (structural-death guard)", () => {
    const findings: DoctorFinding[] = [];
    safeRun("crashingCheck", "error", () => {
      throw new Error("boom");
    }, findings);

    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe("crashingCheck");
    expect(findings[0].severity).toBe("error");
    expect(findings[0].message).toContain("DETECTOR CRASHED");
    expect(findings[0].message).toContain("boom");
  });
});
