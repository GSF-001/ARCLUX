// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Finding correlation helpers: deduplication (findings carry a
// deterministic id — the same rule+file+line produces the same id across
// runs, so duplicate reports merge naturally) and severity/file grouping
// for reports.

import type { SecuritySeverity } from "../security-analysis/SecuritySeverity";
import type { SecurityFinding } from "../security-analysis/SecurityFinding";

export function dedupeFindings(findings: SecurityFinding[]): SecurityFinding[] {
  const seen = new Set<string>();
  const out: SecurityFinding[] = [];
  for (const finding of findings) {
    if (seen.has(finding.id)) continue;
    seen.add(finding.id);
    out.push(finding);
  }
  return out;
}

export function groupFindingsBySeverity(findings: SecurityFinding[]): Record<SecuritySeverity, SecurityFinding[]> {
  const grouped: Record<SecuritySeverity, SecurityFinding[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const finding of findings) {
    grouped[finding.severity].push(finding);
  }
  return grouped;
}

export function groupFindingsByFile(findings: SecurityFinding[]): Record<string, SecurityFinding[]> {
  const grouped = new Map<string, SecurityFinding[]>();
  for (const finding of findings) {
    const filePath = finding.location.filePath;
    const list = grouped.get(filePath) ?? [];
    list.push(finding);
    grouped.set(filePath, list);
  }
  return Object.fromEntries([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
