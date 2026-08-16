// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Findings x impact correlation: a vulnerability in a module nobody
// imports is lower priority than one in a shared core module. Combines
// each finding with its module's SecurityImpactReport and a deterministic
// priority score.
//
// priorityScore is a documented heuristic (not a CVSS replacement):
//   severityRank (critical=4 .. low=1) * (1 + log2(1 + totalAffected))
// Larger = fix first. Deterministic — same inputs, same score.

import type { Repository } from "../repository/Repository";
import type { SecuritySeverity } from "../security-analysis/SecuritySeverity";
import type { SecurityFinding } from "../security-analysis/SecurityFinding";
import {
  attachImpactToFindings,
  type SecurityImpactReport,
} from "../security-analysis/architecture/SecurityImpactAnalyzer";

const SEVERITY_RANK: Record<SecuritySeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export interface CorrelatedFinding extends SecurityFinding {
  impact: SecurityImpactReport;
  /** Heuristic priority: severityRank * (1 + log2(1 + totalAffected)). */
  priorityScore: number;
}

export function scoreFinding(severity: SecuritySeverity, totalAffected: number): number {
  return SEVERITY_RANK[severity] * (1 + Math.log2(1 + totalAffected));
}

export function correlateFindingsWithImpact(repository: Repository, findings: SecurityFinding[]): CorrelatedFinding[] {
  return attachImpactToFindings(repository, findings)
    .map((f) => ({
      ...f,
      priorityScore: scoreFinding(f.severity, f.impact.totalAffected),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
