// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Coverage for the orphan classification (detectOrphanFiles) and the
// "where to integrate it" recommendation engine (detectOrphanIntegration).

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { detectOrphanFiles } from "../packages/detectors/detectOrphanFiles";
import { detectOrphanIntegration } from "../packages/detectors/detectOrphanIntegration";
import { runDoctor } from "../packages/engine/runDoctor";
import type { ModuleInfo, RepositoryMeta, FileInfo, RawExport } from "../packages/shared/types";

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
  opts: { exports?: RawExport[]; imports?: string[]; resolvedImports?: ResolvedImport[]; importedBy?: string[] } = {}
): ModuleInfo {
  const imports = opts.imports ?? [];
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports: opts.exports ?? [],
    resolvedReExports: {},
    importedBy: opts.importedBy ?? [],
    imports,
    resolvedImports: (opts.resolvedImports ?? imports.map((moduleId) => ({ moduleId, namedImports: [], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }))).map((r) => ({ ...r, kind: "static" as const })),
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

function byPath(findings: Array<{ filePath: string }>): Map<string, any> {
  return new Map(findings.map((f) => [f.filePath, f]));
}

describe("detectOrphanFiles — classification", () => {
  it("classifies a file in a fully orphaned folder with no exports as dead", () => {
    const repo = makeRepository([
      makeModule("src/legacy/old-backup.ts", { exports: [] }),
      makeModule("src/legacy/scratch.ts", { exports: [] }),
      makeModule("src/main.ts", { exports: [named("main")], importedBy: [] }),
    ]);
    const findings = byPath(detectOrphanFiles(repo));
    const backup = findings.get("src/legacy/old-backup.ts");
    expect(backup.classification).toBe("dead");
    expect(backup.evidence.length).toBeGreaterThan(0);
    const scratch = findings.get("src/legacy/scratch.ts");
    expect(scratch.classification).toBe("dead");
  });

  it("classifies an unwired file whose siblings are all imported as unwired", () => {
    const repo = makeRepository([
      makeModule("src/components/Button.tsx", { importedBy: ["src/pages/Home.tsx"] }),
      makeModule("src/components/Card.tsx", { importedBy: ["src/pages/Home.tsx"] }),
      makeModule("src/components/Modal.tsx", { importedBy: [] }),
      makeModule("src/pages/Home.tsx", { exports: [named("Home")], imports: ["src/components/Button.tsx", "src/components/Card.tsx"] }),
    ]);
    const findings = byPath(detectOrphanFiles(repo));
    const modal = findings.get("src/components/Modal.tsx");
    expect(modal.classification).toBe("unwired");
    expect(modal.evidence.some((e: string) => e.includes("sibling"))).toBe(true);
  });

  it("boosts unwired classification when siblings share a structural name pattern", () => {
    const repo = makeRepository([
      makeModule("src/services/authService.ts", { importedBy: ["src/api/client.ts"] }),
      makeModule("src/services/userService.ts", { importedBy: ["src/api/client.ts"] }),
      makeModule("src/services/paymentService.ts", { importedBy: [] }),
      makeModule("src/api/client.ts", { exports: [named("client")] }),
    ]);
    const findings = byPath(detectOrphanFiles(repo));
    expect(findings.get("src/services/paymentService.ts").classification).toBe("unwired");
  });

  it("classifies as ambiguous when signals are weak or mixed", () => {
    const repo = makeRepository([
      makeModule("src/misc/a.ts", { exports: [named("a")], importedBy: [] }),
      makeModule("src/misc/b.ts", { exports: [named("b")], importedBy: [] }),
    ]);
    const findings = byPath(detectOrphanFiles(repo));
    expect(findings.get("src/misc/a.ts").classification).toBe("ambiguous");
  });

  it("keeps story files ambiguous (standalone by design)", () => {
    const repo = makeRepository([
      makeModule("src/components/Button.stories.tsx", { exports: [], imports: [] }),
    ]);
    const findings = byPath(detectOrphanFiles(repo));
    expect(findings.get("src/components/Button.stories.tsx").classification).toBe("ambiguous");
  });

  it("classifies a file whose barrel index imports siblings but not it as unwired", () => {
    const repo = makeRepository([
      makeModule("src/features/auth/index.ts", { imports: ["src/features/auth/login.ts"], importedBy: ["src/app.ts"] }),
      makeModule("src/features/auth/login.ts", { imports: [], importedBy: ["src/features/auth/index.ts"] }),
      makeModule("src/features/auth/register.ts", { imports: [], importedBy: [] }),
      makeModule("src/app.ts", { exports: [named("app")] }),
    ]);
    const findings = byPath(detectOrphanFiles(repo));
    const register = findings.get("src/features/auth/register.ts");
    expect(register.classification).toBe("unwired");
    expect(register.evidence.some((e: string) => e.includes("barrel"))).toBe(true);
  });
});

describe("detectOrphanIntegration — where to wire it", () => {
  it("recommends the folder barrel index for an unwired component", () => {
    const repo = makeRepository([
      makeModule("src/components/index.ts", {
        imports: ["src/components/Button.tsx", "src/components/Card.tsx"],
        importedBy: ["src/app.ts"],
      }),
      makeModule("src/components/Button.tsx", { importedBy: ["src/components/index.ts"] }),
      makeModule("src/components/Card.tsx", { importedBy: ["src/components/index.ts"] }),
      makeModule("src/components/Modal.tsx", { importedBy: [] }),
      makeModule("src/app.ts", { exports: [named("app")] }),
    ]);
    const findings = byPath(detectOrphanIntegration(repo));
    const modal = findings.get("src/components/Modal.tsx");
    expect(modal.classification).toBe("unwired");
    expect(modal.suggestedImporters).toHaveLength(1);
    expect(modal.suggestedImporters[0].filePath).toBe("src/components/index.ts");
    expect(modal.suggestedImporters[0].confidence).toBe("high");
    expect(modal.suggestedImporters[0].viaSiblings).toEqual(["src/components/Button.tsx", "src/components/Card.tsx"]);
  });

  it("recommends the shared importer of same-pattern siblings with high confidence", () => {
    const repo = makeRepository([
      makeModule("src/services/authService.ts", { importedBy: ["src/api/client.ts"] }),
      makeModule("src/services/userService.ts", { importedBy: ["src/api/client.ts"] }),
      makeModule("src/services/paymentService.ts", { importedBy: [] }),
      makeModule("src/api/client.ts", { exports: [named("client")] }),
    ]);
    const findings = byPath(detectOrphanIntegration(repo));
    const payment = findings.get("src/services/paymentService.ts");
    expect(payment.suggestedImporters).toHaveLength(1);
    const suggestion = payment.suggestedImporters[0];
    expect(suggestion.filePath).toBe("src/api/client.ts");
    expect(suggestion.confidence).toBe("high");
    expect(suggestion.score).toBe(1);
    expect(suggestion.reason).toContain("Service");
  });

  it("scores a partial importer overlap as medium confidence", () => {
    const repo = makeRepository([
      makeModule("src/features/orders/orderApi.ts", { importedBy: ["src/api/root.ts"] }),
      makeModule("src/features/orders/invoiceApi.ts", { importedBy: ["src/api/root.ts"] }),
      makeModule("src/features/orders/catalogApi.ts", { importedBy: ["src/api/other.ts"] }),
      makeModule("src/features/orders/reportApi.ts", { importedBy: [] }),
      makeModule("src/api/root.ts", { exports: [named("root")] }),
      makeModule("src/api/other.ts", { exports: [named("other")] }),
    ]);
    const findings = byPath(detectOrphanIntegration(repo));
    const report = findings.get("src/features/orders/reportApi.ts");
    const scores = new Set(report.suggestedImporters.map((s: any) => s.score));
    // 2/3 siblings share src/api/root.ts -> score 0.67 (high); 1/3 -> 0.33 (medium).
    expect(report.suggestedImporters[0].filePath).toBe("src/api/root.ts");
    expect(report.suggestedImporters[0].confidence).toBe("high");
    expect(scores.has(1 / 3)).toBe(true);
  });

  it("offers no suggestions for dead code", () => {
    const repo = makeRepository([
      makeModule("src/legacy/old-backup.ts", { exports: [] }),
      makeModule("src/legacy/scratch.ts", { exports: [] }),
      makeModule("src/main.ts", { exports: [named("main")] }),
    ]);
    const findings = byPath(detectOrphanIntegration(repo));
    const backup = findings.get("src/legacy/old-backup.ts");
    expect(backup.classification).toBe("dead");
    expect(backup.suggestedImporters).toEqual([]);
    expect(backup.message).toContain("dead code");
  });

  it("offers no suggestions when no integration pattern exists", () => {
    const repo = makeRepository([
      makeModule("src/misc/a.ts", { exports: [named("a")], importedBy: [] }),
      makeModule("src/misc/b.ts", { exports: [named("b")], importedBy: [] }),
    ]);
    const findings = byPath(detectOrphanIntegration(repo));
    expect(findings.get("src/misc/a.ts").suggestedImporters).toEqual([]);
  });

  it("is wired into runDoctor with its own checkId", () => {
    const repo = makeRepository([
      makeModule("src/services/authService.ts", { importedBy: ["src/api/client.ts"] }),
      makeModule("src/services/userService.ts", { importedBy: ["src/api/client.ts"] }),
      makeModule("src/services/paymentService.ts", { importedBy: [] }),
      makeModule("src/api/client.ts", { exports: [named("client")] }),
    ]);
    const result = runDoctor(repo);
    const integration = result.findings.filter((f) => f.checkId === "orphanIntegration");
    expect(integration.length).toBeGreaterThan(0);
    const payment = integration.find((f) => f.filePath === "src/services/paymentService.ts");
    expect(payment).toBeDefined();
    expect(payment!.message).toContain("src/api/client.ts");
    expect(payment!.severity).toBe("warning");
  });
});