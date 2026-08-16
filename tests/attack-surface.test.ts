// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for packages/correlation. The attack-surface assertions encode the
// measured results of EXPERIMENTS_LOG.md exp "AttackSurfaceMapper"
// (2026-08-16): entry union (convention+structural), BFS reachability,
// sink distances, disconnected-cycle exclusion.

import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildIndex } from "../packages/indexer/buildIndex";
import { buildDependencyGraph } from "../packages/graph/buildDependencyGraph";
import { Repository } from "../packages/repository/Repository";
import type { RepositoryMeta, DependencyGraph } from "../packages/shared/types";
import { parserRegistry } from "../packages/parser/core/ParserRegistry";
import { parseTs } from "../packages/parser/typescript/parseTs";
import { parsePython } from "../packages/parser/python/parsePython";
import { parseJs } from "../packages/parser/javascript/parseJs";
import { parseJsx } from "../packages/parser/javascript/parseJsx";
import { parseCommonJs } from "../packages/parser/javascript/parseCommonJs";
import { parseGo } from "../packages/parser/go/parseGo";
import { parseJava } from "../packages/parser/java/parseJava";
import {
  mapAttackSurface,
  type AttackSurfaceMap,
} from "../packages/correlation/AttackSurfaceMapper";
import {
  dedupeFindings,
  groupFindingsBySeverity,
  groupFindingsByFile,
} from "../packages/correlation/FindingCorrelator";
import { correlateFindingsWithImpact, scoreFinding } from "../packages/correlation/ImpactCorrelation";
import { linkFindingsToProvenance } from "../packages/correlation/EvidenceCorrelator";
import { buildImpactSnapshot } from "../packages/correlation/ImpactSnapshot";
import type { SecurityFinding } from "../packages/security-analysis/types";

parserRegistry.register(parseTs);
parserRegistry.register(parsePython);
parserRegistry.register(parseJs);
parserRegistry.register(parseJsx);
parserRegistry.register(parseCommonJs);
parserRegistry.register(parseGo);
parserRegistry.register(parseJava);

async function analyzeFixture(name: string): Promise<{ repository: Repository; graph: DependencyGraph }> {
  const rootPath = path.join(__dirname, "..", "playground", name);
  const meta: RepositoryMeta = {
    id: name,
    org: "local",
    name,
    defaultBranch: "main",
    rootPath,
    detectedFrameworks: [],
    packageManager: "unknown",
    analyzedAt: new Date().toISOString(),
  };
  const repository = await buildIndex({ rootPath, meta });
  return { repository, graph: buildDependencyGraph(repository) };
}

// ─────────────────────────────────────────────
// AttackSurfaceMapper — e2e, assertions from the experiment
// ─────────────────────────────────────────────

describe("mapAttackSurface over playground/express-demo (experiment assertions)", () => {
  let repository: Repository;
  let graph: DependencyGraph;
  let map: AttackSurfaceMap;

  beforeAll(async () => {
    ({ repository, graph } = await analyzeFixture("express-demo"));
    map = mapAttackSurface(repository, graph);
  }, 30_000);

  it("uses structural entries when no convention entries exist", () => {
    expect(map.entryPoints).toContain("app.ts"); // structural entry (no importers)
    expect(map.entryPoints).toHaveLength(1);
  });

  it("measures the experiment's reachability (4/6) and sink distances", () => {
    expect(map.reachableModules).toHaveLength(4);
    expect(map.unreachableModules).toEqual(expect.arrayContaining(["cyclicA.ts", "cyclicB.ts"]));

    const utils = map.exposures.find((e) => e.targetModuleId === "utils.ts");
    expect(utils!.reachable).toBe(true);
    expect(utils!.distance).toBe(2); // experiment: utils dist=2

    const userController = map.exposures.find((e) => e.targetModuleId === "userController.ts");
    expect(userController!.distance).toBe(1);
    expect(userController!.path).toEqual(["app.ts", "userController.ts"]);
  });

  it("marks disconnected cycles as unreachable with null path", () => {
    const cyclicA = map.exposures.find((e) => e.targetModuleId === "cyclicA.ts");
    expect(cyclicA!.reachable).toBe(false);
    expect(cyclicA!.distance).toBeNull();
    expect(cyclicA!.path).toBeNull();
  });

  it("adds explicit extra entry paths to the entry set", () => {
    const withExtra = mapAttackSurface(repository, graph, { extraEntryPaths: ["cyclicA.ts"] });
    expect(withExtra.entryPoints).toEqual(expect.arrayContaining(["app.ts", "cyclicA.ts"]));
    expect(withExtra.reachableModules).toContain("cyclicA.ts");
    expect(withExtra.reachableModules).toContain("cyclicB.ts"); // now reachable via the cycle
  });
});

describe("mapAttackSurface over playground/nextjs-demo", () => {
  let repository: Repository;
  let graph: DependencyGraph;
  let map: AttackSurfaceMap;

  beforeAll(async () => {
    ({ repository, graph } = await analyzeFixture("nextjs-demo"));
    map = mapAttackSurface(repository, graph);
  }, 30_000);

  it("finds page.tsx as the structural entry and lib.ts at distance 1", () => {
    expect(map.entryPoints).toContain("page.tsx");
    const lib = map.exposures.find((e) => e.targetModuleId === "lib.ts");
    expect(lib!.reachable).toBe(true);
    expect(lib!.distance).toBe(1); // experiment: lib dist=1
  });

  it("respects a custom maxDepth", () => {
    const shallow = mapAttackSurface(repository, graph, { maxDepth: 0 });
    expect(shallow.reachableModules).toHaveLength(1); // only the entry itself
  });
});

// ─────────────────────────────────────────────
// FindingCorrelator — unit
// ─────────────────────────────────────────────

function finding(id: string, severity: SecurityFinding["severity"], filePath: string): SecurityFinding {
  return {
    id,
    ruleId: id.split(":")[0]!,
    title: "t",
    description: "d",
    severity,
    confidence: "high",
    location: { moduleId: filePath, filePath },
  };
}

describe("FindingCorrelator", () => {
  it("dedupes by deterministic id", () => {
    const f = finding("r:a.ts:1", "high", "a.ts");
    expect(dedupeFindings([f, { ...f }, finding("r:b.ts:2", "low", "b.ts")])).toHaveLength(2);
  });

  it("groups by severity with all four buckets present", () => {
    const grouped = groupFindingsBySeverity([
      finding("1:a.ts", "critical", "a.ts"),
      finding("2:a.ts", "high", "a.ts"),
      finding("3:b.ts", "low", "b.ts"),
    ]);
    expect(grouped.critical).toHaveLength(1);
    expect(grouped.high).toHaveLength(1);
    expect(grouped.medium).toHaveLength(0);
    expect(grouped.low).toHaveLength(1);
  });

  it("groups by file, sorted by path", () => {
    const grouped = groupFindingsByFile([
      finding("1:b.ts", "low", "b.ts"),
      finding("2:a.ts", "high", "a.ts"),
    ]);
    expect(Object.keys(grouped)).toEqual(["a.ts", "b.ts"]);
  });
});

// ─────────────────────────────────────────────
// ImpactCorrelation — unit
// ─────────────────────────────────────────────

describe("ImpactCorrelation", () => {
  it("scores severity times impact growth", () => {
    expect(scoreFinding("critical", 0)).toBe(4); // 4 * (1 + log2(1)) = 4
    expect(scoreFinding("critical", 3)).toBeGreaterThan(4); // consumers raise the score
    expect(scoreFinding("low", 3)).toBeLessThan(scoreFinding("high", 3));
  });

  it("correlateFindingsWithImpact enriches and sorts by priority", async () => {
    const { repository } = await analyzeFixture("express-demo");
    const findings = [finding("x:app.ts", "high", "app.ts"), finding("y:utils.ts", "low", "utils.ts")];
    const correlated = correlateFindingsWithImpact(repository, findings);
    expect(correlated).toHaveLength(2);
    expect(correlated[0]!.priorityScore).toBeGreaterThanOrEqual(correlated[1]!.priorityScore);
    expect(correlated[0]!.impact).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// ImpactSnapshot — unit
// ─────────────────────────────────────────────

describe("buildImpactSnapshot", () => {
  it("reports consumers and notFound", async () => {
    const { repository } = await analyzeFixture("express-demo");
    const snapshot = buildImpactSnapshot(repository, "utils.ts");
    expect(snapshot.notFound).toBe(false);
    expect(snapshot.totalAffected).toBeGreaterThan(0);
    expect(snapshot.affectedFiles.some((f) => f.filePath === "app.ts")).toBe(true);

    const missing = buildImpactSnapshot(repository, "nope.ts");
    expect(missing.notFound).toBe(true);
  });
});

// ─────────────────────────────────────────────
// EvidenceCorrelator — unit
// ─────────────────────────────────────────────

describe("EvidenceCorrelator", () => {
  it("stamps provenanceId on every finding and returns the record id", () => {
    const findings = [finding("1:a.ts", "high", "a.ts"), finding("2:b.ts", "low", "b.ts")];
    const { recordId, findings: linked } = linkFindingsToProvenance({
      findings,
      source: { url: "https://github.com/GSF-001/ARCLUX.git", acquiredAt: "2026-08-16T00:00:00.000Z" },
      evidence: { toolId: "arclux.security-analysis", toolVersion: "0.1.0", executedAt: "2026-08-16T00:00:00.000Z" },
      snapshotId: "snap-1",
    });
    expect(recordId).toMatch(/^prov-/);
    expect(linked.every((f) => f.provenanceId === recordId)).toBe(true);
    // original findings untouched (no mutation)
    expect(findings.every((f) => f.provenanceId === undefined)).toBe(true);
  });
});
