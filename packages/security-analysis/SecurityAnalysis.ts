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

export interface SecurityAnalysis {
  target: string;
  findings: SecurityFinding[];
  analyzedAt: string;
}

export function createSecurityAnalysis(target: string, findings: SecurityFinding[]): SecurityAnalysis {
  return { target, findings, analyzedAt: new Date().toISOString() };
}

/** Run all source-level checks against an immutable source snapshot. */
export function analyzeSecuritySource(options: SecurityAnalysisOptions): SecurityAnalysis {
  const findings = options.files.flatMap(({ file, source }) => [
    ...detectLegacySecrets(file, source),
    ...detectLegacyUnsafePatterns(file, source),
    ...detectDangerousApis(file, source),
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
    const key = `${finding.ruleId}:${finding.location.filePath}:${finding.location.line ?? 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectLegacySecrets(file: string, source: string): SecurityFinding[] {
  const patterns = [
    /(?:api[_-]?key|secret|access[_-]?token|private[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  ];
  return source.split(/\r?\n/).flatMap((line, index) =>
    patterns.some((pattern) => pattern.test(line))
      ? [{
          id: `legacy-secret:${file}:${index + 1}`,
          ruleId: "legacy-secret-exposure",
          title: "Potential secret exposure",
          description: "A source line matches a credential-like pattern.",
          severity: "high" as const,
          confidence: "medium" as const,
          location: { moduleId: file, filePath: file, line: index + 1 },
        }]
      : [],
  );
}

function detectLegacyUnsafePatterns(file: string, source: string): SecurityFinding[] {
  const patterns: Array<[RegExp, string]> = [
    [/\beval\s*\(/, "Dynamic code evaluation"],
    [/\bnew\s+Function\s*\(/, "Dynamic function construction"],
  ];
  return source.split(/\r?\n/).flatMap((line, index) =>
    patterns.flatMap(([pattern, title]) =>
      pattern.test(line)
        ? [{
            id: `legacy-unsafe:${file}:${index + 1}`,
            ruleId: "legacy-unsafe-pattern",
            title,
            description: "A potentially unsafe dynamic execution pattern was detected.",
            severity: "medium" as const,
            confidence: "medium" as const,
            location: { moduleId: file, filePath: file, line: index + 1 },
          }]
        : [],
    ),
  );
}
