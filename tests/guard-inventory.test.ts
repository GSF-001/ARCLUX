// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// GUARD INVENTORY — negative controls for the detectors that had NO
// committed positive-control test (2026-08-14 audit, OWP §4.1 lens):
// detectDeadCode, detectDuplicateModules, detectEntryPoints,
// detectIndexFiles, detectLargeModules, detectLayerViolation,
// detectSharedModules. Each detector gets a KNOWN-BAD fixture (must
// fire) and a clean fixture (must not fire) — the "detector definitely
// fires on a planted violation" guarantee. Full 19-detector coverage
// matrix lives in tests/README.md.
//
// NOTE: detectLayerViolation + detectDeadCode were previously verified
// manually with positive controls (see progres/status-detectors.md) but
// never committed — this file makes those regressions permanent.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { detectDeadCode } from "../packages/detectors/detectDeadCode";
import { detectDuplicateModules } from "../packages/detectors/detectDuplicateModules";
import { detectEntryPoints } from "../packages/detectors/detectEntryPoints";
import { detectIndexFiles } from "../packages/detectors/detectIndexFiles";
import { detectLargeModules } from "../packages/detectors/detectLargeModules";
import { detectLayerViolation } from "../packages/detectors/detectLayerViolation";
import { detectSharedModules } from "../packages/detectors/detectSharedModules";
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

function reExport(name: string, source: string, line = 1): RawExport {
  return { name, kind: "re-export", reExportSource: source, line };
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
    sizeBytes?: number;
    hash?: string;
  } = {}
): ModuleInfo {
  const imports = opts.imports ?? [];
  return {
    id: relativePath,
    file: { ...makeFile(relativePath, opts.sizeBytes), hash: opts.hash ?? `hash-${relativePath}` },
    exports: opts.exports ?? [],
    resolvedReExports: {},
    importedBy: opts.importedBy ?? [],
    imports,
    resolvedImports: opts.resolvedImports ?? imports.map((moduleId) => ({ moduleId, namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 1 })),
    calls: [],
    calledBy: [],
    implicitDependencies: [],
  };
}

function makeRepository(modules: ModuleInfo[]): Repository {
  const meta: RepositoryMeta = {
    id: "guard-inventory",
    org: "test-org",
    name: "guard-inventory",
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

describe("detectLargeModules — positive control", () => {
  it("flags a file above the 15,000-byte threshold", () => {
    const repo = makeRepository([makeModule("src/big.ts", { sizeBytes: 16_000 })]);
    const findings = detectLargeModules(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/big.ts");
  });

  it("passes a file below the threshold", () => {
    const repo = makeRepository([makeModule("src/small.ts", { sizeBytes: 1_000 })]);
    expect(detectLargeModules(repo)).toHaveLength(0);
  });
});

describe("detectSharedModules — positive control", () => {
  it("flags a module imported by 5+ modules (fan-in >= minImporters)", () => {
    const importers = Array.from({ length: 5 }, (_, i) => `src/importer-${i}.ts`);
    const repo = makeRepository([
      makeModule("src/hub.ts", { importedBy: importers }),
      ...importers.map((id) => makeModule(id, { imports: ["src/hub.ts"] })),
    ]);
    const findings = detectSharedModules(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/hub.ts");
    expect(findings[0].importerCount).toBe(5);
  });

  it("passes a module with low fan-in", () => {
    const repo = makeRepository([makeModule("src/quiet.ts", { importedBy: ["src/a.ts"] })]);
    expect(detectSharedModules(repo)).toHaveLength(0);
  });
});

describe("detectDuplicateModules — positive control", () => {
  it("groups modules with identical content hashes (above min size)", () => {
    const repo = makeRepository([
      makeModule("src/copy-a.ts", { hash: "same-content", sizeBytes: 400 }),
      makeModule("src/copy-b.ts", { hash: "same-content", sizeBytes: 400 }),
    ]);
    const findings = detectDuplicateModules(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePaths.sort()).toEqual(["src/copy-a.ts", "src/copy-b.ts"]);
  });

  it("passes modules with distinct hashes", () => {
    const repo = makeRepository([
      makeModule("src/a.ts", { hash: "h-a", sizeBytes: 400 }),
      makeModule("src/b.ts", { hash: "h-b", sizeBytes: 400 }),
    ]);
    expect(detectDuplicateModules(repo)).toHaveLength(0);
  });
});

describe("detectIndexFiles — positive control", () => {
  it("flags an index.ts that mixes re-exports with its own definitions", () => {
    const repo = makeRepository([
      makeModule("src/index.ts", { exports: [named("ownHelper"), reExport("thing", "./thing")] }),
    ]);
    const findings = detectIndexFiles(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/index.ts");
    expect(findings[0].isPureBarrel).toBe(false);
  });

  it("passes a pure barrel (all exports are re-exports)", () => {
    const repo = makeRepository([
      makeModule("src/index.ts", { exports: [reExport("a", "./a"), reExport("b", "./b")] }),
    ]);
    const findings = detectIndexFiles(repo);
    expect(findings).toHaveLength(1); // still reported, but as a pure barrel
    expect(findings[0].isPureBarrel).toBe(true);
  });
});

describe("detectLayerViolation — positive control", () => {
  it("flags packages/shared importing a sibling package", () => {
    const repo = makeRepository([
      makeModule("packages/shared/utils.ts", { imports: ["packages/other/thing.ts"] }),
      makeModule("packages/other/thing.ts"),
    ]);
    const findings = detectLayerViolation(repo);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].filePath).toBe("packages/shared/utils.ts");
  });

  it("passes packages/shared importing only itself", () => {
    const repo = makeRepository([makeModule("packages/shared/a.ts", { imports: ["packages/shared/b.ts"] })]);
    expect(detectLayerViolation(repo)).toHaveLength(0);
  });
});

describe("detectDeadCode — positive control", () => {
  it("flags a module that is imported (side-effect) but every own export is unused", () => {
    const repo = makeRepository([
      makeModule("src/effects.ts", { exports: [named("helper")], importedBy: ["src/consumer.ts"] }),
      makeModule("src/consumer.ts", {
        imports: ["src/effects.ts"],
        // side-effect import: namedImports empty, so "helper" stays unused
        resolvedImports: [{ moduleId: "src/effects.ts", namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
      }),
    ]);
    const findings = detectDeadCode(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("src/effects.ts");
  });

  it("passes a module whose export IS imported by name", () => {
    const repo = makeRepository([
      makeModule("src/used.ts", { exports: [named("helper")] }),
      makeModule("src/consumer.ts", {
        imports: ["src/used.ts"],
        resolvedImports: [{ moduleId: "src/used.ts", namedImports: ["helper"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
      }),
    ]);
    expect(detectDeadCode(repo)).toHaveLength(0);
  });
});

describe("detectEntryPoints — positive control", () => {
  it("classifies an orphaned CLI entry file as an entry point", () => {
    const repo = makeRepository([makeModule("apps/cli/index.ts")]);
    const findings = detectEntryPoints(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("apps/cli/index.ts");
  });

  it("passes an orphaned file with no entry-point convention", () => {
    const repo = makeRepository([makeModule("src/plain.ts")]);
    expect(detectEntryPoints(repo)).toHaveLength(0);
  });
});
