// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SecurityFinding } from "./SecurityFinding";
import type { SecurityFile, SecurityAnalysisOptions } from "./contracts";
import { detectDangerousApis } from "./source/DangerousApiDetector";
import { detectSecretExposure } from "./source/SecretExposureDetector";
import { detectUnsafePatterns } from "./source/UnsafePatternDetector";
import type { CapabilityAssessment } from "./capability/AssessmentOrchestrator";

export interface SecurityAnalysis {
  target: string;
  findings: SecurityFinding[];
  analyzedAt: string;
  capabilityAssessment?: CapabilityAssessment;
}

export function createSecurityAnalysis(target: string, findings: SecurityFinding[]): SecurityAnalysis {
  return { target, findings, analyzedAt: new Date().toISOString() };
}

/** Run all source-level checks against an immutable source snapshot. */
export function analyzeSecuritySource(options: SecurityAnalysisOptions): SecurityAnalysis {
  const findings = options.files.flatMap(({ file, source }) => [
    ...detectSecretExposure(file, source),
    ...detectDangerousApis(file, source),
    ...detectUnsafePatterns(file, source),
  ]);
  return {
    target: options.target,
    findings: deduplicateFindings(findings),
    analyzedAt: options.analyzedAt ?? new Date().toISOString(),
  };
}

function deduplicateFindings(findings: SecurityFinding[]): SecurityFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const evidence = finding.evidence[0];
    const key = `${finding.category}:${evidence?.file ?? ""}:${evidence?.line ?? 0}:${finding.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
