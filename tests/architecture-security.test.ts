// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for packages/security-analysis/architecture analyzers:
// trust boundary imports, cross-boundary calls, security impact.
// Unit cases use in-memory repositories; end-to-end uses the real
// playground/nest-demo fixture through buildIndex (real path, per
// CONTRIBUTING.md verification standard).

import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildIndex } from "../packages/indexer/buildIndex";
import { Repository } from "../packages/repository/Repository";
import type { RepositoryMeta } from "../packages/shared/types";
import { parserRegistry } from "../packages/parser/core/ParserRegistry";
import { parseTs } from "../packages/parser/typescript/parseTs";
import { parsePython } from "../packages/parser/python/parsePython";
import { parseJs } from "../packages/parser/javascript/parseJs";
import { parseJsx } from "../packages/parser/javascript/parseJsx";
import { parseCommonJs } from "../packages/parser/javascript/parseCommonJs";
import { parseGo } from "../packages/parser/go/parseGo";
import { parseJava } from "../packages/parser/java/parseJava";
import { DiskSourceProvider } from "../packages/security-analysis";
import {
  classifyTrustZone,
  detectTrustBoundaryViolations,
  DEFAULT_TRUST_ZONES,
} from "../packages/security-analysis/architecture/TrustBoundaryAnalyzer";
import { detectCrossBoundaryCalls } from "../packages/security-analysis/architecture/CrossBoundaryAnalyzer";
import { analyzeSecurityImpact, attachImpactToFindings } from "../packages/security-analysis/architecture/SecurityImpactAnalyzer";
import type { ModuleInfo } from "../packages/shared/types";

parserRegistry.register(parseTs);
parserRegistry.register(parsePython);
parserRegistry.register(parseJs);
parserRegistry.register(parseJsx);
parserRegistry.register(parseCommonJs);
parserRegistry.register(parseGo);
parserRegistry.register(parseJava);

// ─────────────────────────────────────────────
// classifyTrustZone — unit
// ─────────────────────────────────────────────

describe("classifyTrustZone", () => {
  it("classifies untrusted-facing paths", () => {
    expect(classifyTrustZone("app/api/users/route.ts", DEFAULT_TRUST_ZONES)).toBe("untrusted");
    expect(classifyTrustZone("src/controllers/UserController.ts", DEFAULT_TRUST_ZONES)).toBe("untrusted");
  });
  it("classifies trusted internals", () => {
    expect(classifyTrustZone("src/core/auth.ts", DEFAULT_TRUST_ZONES)).toBe("trusted");
    expect(classifyTrustZone("src/services/user.service.ts", DEFAULT_TRUST_ZONES)).toBe("trusted");
    expect(classifyTrustZone("domain/models/User.ts", DEFAULT_TRUST_ZONES)).toBe("trusted");
  });
  it("classifies the boundary layer", () => {
    expect(classifyTrustZone("src/middleware/auth.ts", DEFAULT_TRUST_ZONES)).toBe("boundary");
    expect(classifyTrustZone("src/adapters/db.adapter.ts", DEFAULT_TRUST_ZONES)).toBe("boundary");
  });
  it("returns null for unclassified paths", () => {
    expect(classifyTrustZone("playground/foo/bar.ts", DEFAULT_TRUST_ZONES)).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Trust boundary — e2e over playground/nest-demo
// ─────────────────────────────────────────────

describe("trust boundary over playground/nest-demo", () => {
  let repo: Repository;

  beforeAll(async () => {
    const rootPath = path.join(__dirname, "..", "playground", "nest-demo");
    const meta: RepositoryMeta = {
      id: "nest-demo",
      org: "local",
      name: "nest-demo",
      defaultBranch: "main",
      rootPath,
      detectedFrameworks: [],
      packageManager: "unknown",
      analyzedAt: new Date().toISOString(),
    };
    repo = await buildIndex({ rootPath, meta });
  }, 30_000);

  it("indexes the fixture modules", () => {
    const ids = repo.getAllModules().map((m) => m.id).sort();
    expect(ids).toContain("user.controller.ts");
    expect(ids).toContain("user.service.ts");
    expect(ids).toContain("utils.ts");
  });

  it("flags the controller->service crossing as high", () => {
    const findings = detectTrustBoundaryViolations(repo, new DiskSourceProvider(path.join(__dirname, "..", "playground", "nest-demo")));
    const crossing = findings.find((f) => f.location.filePath === "user.controller.ts");
    expect(crossing).toBeDefined();
    expect(crossing!.severity).toBe("high");
    expect(crossing!.ruleId).toBe("trust-boundary-import");
    expect(crossing!.cwe).toContain("CWE-501");
  });

  it("does NOT flag same-zone or boundary edges", () => {
    const findings = detectTrustBoundaryViolations(repo, new DiskSourceProvider(path.join(__dirname, "..", "playground", "nest-demo")));
    // utils.ts is trusted but imports nothing trusted-facing; app.module.ts is unclassified
    expect(findings.every((f) => f.location.filePath !== "utils.ts")).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Cross-boundary calls — unit (resolved bare calls)
// ─────────────────────────────────────────────

describe("detectCrossBoundaryCalls", () => {
  function makeRepo(modules: ModuleInfo[]): Repository {
    const meta: RepositoryMeta = {
      id: "unit",
      org: "local",
      name: "unit",
      defaultBranch: "main",
      rootPath: "/tmp/unit",
      detectedFrameworks: [],
      packageManager: "unknown",
      analyzedAt: new Date().toISOString(),
    };
    const repo = new Repository(meta);
    for (const m of modules) repo.addModule(m);
    return repo;
  }

  function module(id: string, path2: string, calls: ModuleInfo["calls"]): ModuleInfo {
    return {
      id,
      file: {
        absolutePath: `/tmp/unit/${path2}`,
        relativePath: path2,
        language: "typescript",
        extension: ".ts",
        sizeBytes: 0,
        hash: "h",
      },
      exports: [],
      resolvedReExports: {},
      importedBy: [],
      imports: [],
      resolvedImports: [],
      calls,
      calledBy: [],
      implicitDependencies: [],
    };
  }

  it("flags a resolved call from untrusted code into a trusted function", () => {
    const repo = makeRepo([
      module("handlers/login.ts", "handlers/login.ts", [{ moduleId: "services/auth.service.ts", calleeName: "verifyToken", line: 7 }]),
      module("services/auth.service.ts", "services/auth.service.ts", []),
    ]);
    const findings = detectCrossBoundaryCalls(repo, new DiskSourceProvider("/tmp/unit"));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("cross-boundary-call");
    expect(findings[0].location.line).toBe(7);
    expect(findings[0].location.moduleId).toBe("handlers/login.ts");
  });

  it("ignores calls into non-trusted targets", () => {
    const repo = makeRepo([
      module("handlers/login.ts", "handlers/login.ts", [{ moduleId: "utils/format.ts", calleeName: "format", line: 2 }]),
      module("utils/format.ts", "utils/format.ts", []),
    ]);
    expect(detectCrossBoundaryCalls(repo, new DiskSourceProvider("/tmp/unit"))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// Security impact — e2e over playground/nest-demo
// ─────────────────────────────────────────────

describe("analyzeSecurityImpact over playground/nest-demo", () => {
  let repo: Repository;

  beforeAll(async () => {
    const rootPath = path.join(__dirname, "..", "playground", "nest-demo");
    const meta: RepositoryMeta = {
      id: "nest-demo",
      org: "local",
      name: "nest-demo",
      defaultBranch: "main",
      rootPath,
      detectedFrameworks: [],
      packageManager: "unknown",
      analyzedAt: new Date().toISOString(),
    };
    repo = await buildIndex({ rootPath, meta });
  }, 30_000);

  it("reports consumers of a trusted service module", () => {
    const report = analyzeSecurityImpact(repo, "user.service.ts");
    expect(report.notFound).toBe(false);
    expect(report.totalAffected).toBeGreaterThanOrEqual(1);
    expect(report.consumerTree).not.toBeNull();
    expect(report.consumerTree!.children.length).toBeGreaterThanOrEqual(1);
  });

  it("reports notFound for unknown modules", () => {
    const report = analyzeSecurityImpact(repo, "nope.ts");
    expect(report.notFound).toBe(true);
    expect(report.totalAffected).toBe(0);
  });

  it("attachImpactToFindings enriches each finding", () => {
    const finding = {
      id: "x:user.service.ts:1",
      ruleId: "x",
      title: "t",
      description: "d",
      severity: "high" as const,
      confidence: "high" as const,
      location: { moduleId: "user.service.ts", filePath: "user.service.ts", line: 1 },
    };
    const enriched = attachImpactToFindings(repo, [finding]);
    expect(enriched[0].impact.moduleId).toBe("user.service.ts");
    expect(enriched[0].impact.totalAffected).toBeGreaterThanOrEqual(1);
    expect(enriched[0].impact.findings).toHaveLength(1);
  });
});
