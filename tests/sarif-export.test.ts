// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for packages/security-analysis/reporting: SecurityReport
// (summary counts, attack surface passthrough) and the SARIF 2.1.0 export
// (structural validation of the subset we emit).

import { describe, it, expect } from "vitest";
import {
  buildSecurityReport,
  summarize,
  type ReportAttackSurface,
} from "../packages/security-analysis/reporting/SecurityReport";
import { remediateRule, attachRemediations } from "../packages/security-analysis/reporting/RemediationSuggestion";
import type { SecurityFinding } from "../packages/security-analysis/types";

function finding(id: string, severity: SecurityFinding["severity"], ruleId: string, filePath: string, line?: number): SecurityFinding {
  return {
    id,
    ruleId,
    title: `${ruleId} title`,
    description: `${ruleId} description`,
    severity,
    confidence: "high",
    location: { moduleId: filePath, filePath, line },
    cwe: ["CWE-798"],
    owasp: ["A03:2025"],
  };
}

const SAMPLE_FINDINGS: SecurityFinding[] = [
  finding("aws-access-key:app.ts:1", "high", "aws-access-key", "app.ts", 1),
  finding("unsafe-eval:app.ts:5", "high", "unsafe-eval", "app.ts", 5),
  finding("weak-crypto-md5:lib.ts:9", "medium", "weak-crypto-md5", "lib.ts", 9),
  finding("trust-boundary-import:user.controller.ts", "high", "trust-boundary-import", "user.controller.ts"),
];

const SURFACE: ReportAttackSurface = {
  entryPoints: ["app.ts"],
  reachableModules: ["app.ts", "lib.ts"],
  unreachableModules: ["cyclicA.ts"],
  exposures: [
    { targetModuleId: "lib.ts", filePath: "lib.ts", reachable: true, distance: 1, path: ["app.ts", "lib.ts"] },
  ],
};

describe("SecurityReport", () => {
  it("summarizes severity counts", () => {
    expect(summarize(SAMPLE_FINDINGS)).toEqual({ total: 4, critical: 0, high: 3, medium: 1, low: 0 });
  });

  it("builds a report with attack surface and provenance passthrough", () => {
    const report = buildSecurityReport({
      repositoryId: "repo-1",
      findings: SAMPLE_FINDINGS,
      attackSurface: SURFACE,
      provenance: [],
    });
    expect(report.repositoryId).toBe("repo-1");
    expect(report.summary.total).toBe(4);
    expect(report.attackSurface).toBe(SURFACE);
    expect(report.provenance).toEqual([]);
    expect(new Date(report.createdAt).toISOString()).toBe(report.createdAt);
  });

  it("attaches remediations by default and skips them when disabled", () => {
    const withFixes = buildSecurityReport({ repositoryId: "r", findings: SAMPLE_FINDINGS });
    expect(withFixes.findings.every((f) => f.remediation !== undefined)).toBe(true);
    const withoutFixes = buildSecurityReport({ repositoryId: "r", findings: SAMPLE_FINDINGS, withRemediations: false });
    expect(withoutFixes.findings.every((f) => f.remediation === undefined)).toBe(true);
  });

  it("toJson returns the ARCLUX shape", () => {
    const report = buildSecurityReport({ repositoryId: "r", findings: SAMPLE_FINDINGS });
    const parsed = JSON.parse(report.toJson()) as { repositoryId: string; findings: SecurityFinding[] };
    expect(parsed.repositoryId).toBe("r");
    expect(parsed.findings).toHaveLength(4);
  });
});

describe("SARIF 2.1.0 export", () => {
  it("produces a structurally valid minimal SARIF log", () => {
    const report = buildSecurityReport({ repositoryId: "r", findings: SAMPLE_FINDINGS });
    const sarif = JSON.parse(report.toSarif()) as {
      $schema: string;
      version: string;
      runs: Array<{
        tool: { driver: { name: string; version: string; rules: Array<{ id: string; defaultConfiguration: { level: string } }> } };
        results: Array<{ ruleId: string; level: string; locations: Array<{ physicalLocation: { artifactLocation: { uri: string }; region?: { startLine: number } } }>; fingerprints: Record<string, string> }>;
      }>;
    };

    expect(sarif.$schema).toContain("sarif-2.1.0");
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);

    const run = sarif.runs[0]!;
    expect(run.tool.driver.name).toBe("arclux.security-analysis");
    // one rule per distinct ruleId
    expect(run.tool.driver.rules).toHaveLength(4);

    // severity -> level mapping: high -> error, medium -> warning
    const levels = new Set(run.results.map((r) => r.level));
    expect(levels).toEqual(new Set(["error", "warning"]));

    // locations carry uri + startLine when available
    const awsResult = run.results.find((r) => r.ruleId === "aws-access-key")!;
    expect(awsResult.locations[0]!.physicalLocation.artifactLocation.uri).toBe("app.ts");
    expect(awsResult.locations[0]!.physicalLocation.region!.startLine).toBe(1);
    expect(awsResult.fingerprints["arcluxSecurity/v1"]).toBe("aws-access-key:app.ts:1");

    // file-level finding: no region
    const trustResult = run.results.find((r) => r.ruleId === "trust-boundary-import")!;
    expect(trustResult.locations[0]!.physicalLocation.region).toBeUndefined();
  });
});

describe("remediation templates", () => {
  it("returns a suggestion for known rules and null for unknown", () => {
    expect(remediateRule("aws-access-key")).not.toBeNull();
    expect(remediateRule("unsafe-eval")).not.toBeNull();
    expect(remediateRule("no-such-rule")).toBeNull();
  });

  it("attachRemediations only enriches findings with templates", () => {
    const unknown = finding("x:a.ts", "high", "no-such-rule", "a.ts");
    const enriched = attachRemediations([unknown]);
    expect(enriched[0]!.remediation).toBeUndefined();
  });
});
