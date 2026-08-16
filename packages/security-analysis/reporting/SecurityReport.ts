// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// SecurityReport: the aggregate, serializable output of the security
// pipeline. Two serialization formats:
//   toJson()  — ARCLUX's own compact shape
//   toSarif() — SARIF 2.1.0 (OASIS Committee Specification; the format
//               gitleaks/semgrep/codeql all emit — verified 2026-08-16).
//               Deliberately a minimal valid subset (driver + rules +
//               results + locations + fingerprints); advanced SARIF
//               features (codeFlows, taxonomies, invocations) are a
//               documented deferral.
//
// NOTE on import direction: this file declares ReportAttackSurface as a
// STRUCTURAL subset of correlation's AttackSurfaceMap so security-analysis
// never imports packages/correlation (which imports security-analysis —
// that would be a cycle).

import type { SecuritySeverity } from "../SecuritySeverity";
import type { SecurityFinding } from "../SecurityFinding";
import type { ProvenanceRecord } from "../../provenance/ProvenanceRecord";
import { attachRemediations } from "./RemediationSuggestion";

export interface ReportAttackSurface {
  entryPoints: string[];
  reachableModules: string[];
  unreachableModules: string[];
  exposures: Array<{
    targetModuleId: string;
    filePath: string;
    reachable: boolean;
    distance: number | null;
    path: string[] | null;
  }>;
}

export interface SecurityReportSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface SecurityReport {
  repositoryId: string;
  createdAt: string;
  summary: SecurityReportSummary;
  findings: SecurityFinding[];
  attackSurface?: ReportAttackSurface;
  provenance?: ProvenanceRecord[];
  /** JSON string (ARCLUX shape). */
  toJson(): string;
  /** JSON string (SARIF 2.1.0 subset). */
  toSarif(): string;
}

export interface BuildSecurityReportInput {
  repositoryId: string;
  findings: SecurityFinding[];
  attackSurface?: ReportAttackSurface;
  provenance?: ProvenanceRecord[];
  /** When true, findings get remediation templates attached (default true). */
  withRemediations?: boolean;
}

const SARIF_LEVEL: Record<SecuritySeverity, "error" | "warning" | "note"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "note",
};

export function buildSecurityReport(input: BuildSecurityReportInput): SecurityReport {
  const findings = input.withRemediations === false ? input.findings : attachRemediations(input.findings);
  const summary = summarize(findings);
  const createdAt = new Date().toISOString();

  const report: SecurityReport = {
    repositoryId: input.repositoryId,
    createdAt,
    summary,
    findings,
    toJson: () => JSON.stringify(toJsonShape(report), null, 2),
    toSarif: () => JSON.stringify(toSarifShape(report), null, 2),
  };
  if (input.attackSurface !== undefined) report.attackSurface = input.attackSurface;
  if (input.provenance !== undefined) report.provenance = input.provenance;

  return report;
}

export function summarize(findings: SecurityFinding[]): SecurityReportSummary {
  const summary: SecurityReportSummary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) summary[finding.severity] += 1;
  return summary;
}

function toJsonShape(report: SecurityReport) {
  return {
    repositoryId: report.repositoryId,
    createdAt: report.createdAt,
    summary: report.summary,
    attackSurface: report.attackSurface,
    provenance: report.provenance,
    findings: report.findings,
  };
}

interface SarifRule {
  id: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  defaultConfiguration?: { level: "error" | "warning" | "note" };
  properties?: { cwe?: string[]; owasp?: string[]; tags?: string[] };
}

interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note";
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: { startLine: number };
    };
  }>;
  fingerprints: Record<string, string>;
}

function toSarifShape(report: SecurityReport) {
  const rules = new Map<string, SarifRule>();
  for (const finding of report.findings) {
    const existing = rules.get(finding.ruleId);
    if (existing) continue;
    rules.set(finding.ruleId, {
      id: finding.ruleId,
      shortDescription: { text: finding.title },
      fullDescription: { text: finding.description },
      defaultConfiguration: { level: SARIF_LEVEL[finding.severity] },
      properties: {
        cwe: finding.cwe,
        owasp: finding.owasp,
        tags: finding.cwe ?? [],
      },
    });
  }

  const results: SarifResult[] = report.findings.map((finding) => ({
    ruleId: finding.ruleId,
    level: SARIF_LEVEL[finding.severity],
    message: { text: `${finding.title}: ${finding.description}` },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.location.filePath },
          region: finding.location.line !== undefined ? { startLine: finding.location.line } : undefined,
        },
      },
    ],
    fingerprints: { "arcluxSecurity/v1": finding.id },
  }));

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "arclux.security-analysis",
            version: "0.1.0",
            informationUri: "https://github.com/GSF-001/ARCLUX",
            rules: [...rules.values()],
          },
        },
        results,
      },
    ],
  };
}
