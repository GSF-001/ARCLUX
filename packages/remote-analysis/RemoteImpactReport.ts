// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SecurityFinding } from "../security-analysis/SecurityFinding";

export interface RemoteImpactReport {
  id: string;
  source?: string;
  findings: SecurityFinding[];
  affectedFiles: string[];
  severity: "none" | "low" | "medium" | "high" | "critical";
  metadata?: Record<string, unknown>;
}

export function createRemoteImpactReport(
  source?: string,
  findings: SecurityFinding[] = [],
): RemoteImpactReport {
  const affectedFiles = [...new Set(findings.map((finding) => finding.location.filePath))].sort();
  const severity = findings.reduce<RemoteImpactReport["severity"]>((current, finding) =>
    severityRank(finding.severity) > severityRank(current) ? finding.severity : current,
  "none");
  return { id: crypto.randomUUID(), source, findings: [...findings], affectedFiles, severity };
}

function severityRank(severity: RemoteImpactReport["severity"]): number {
  return { none: 0, low: 1, medium: 2, high: 3, critical: 4 }[severity];
}
