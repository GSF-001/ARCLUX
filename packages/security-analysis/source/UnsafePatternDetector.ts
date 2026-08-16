// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SecurityFinding } from "../SecurityFinding";
const PATTERNS: Array<[RegExp, string]> = [[/\beval\s*\(/, "Dynamic code evaluation"], [/\bnew\s+Function\s*\(/, "Dynamic function construction"]];
export function detectUnsafePatterns(file: string, source: string): SecurityFinding[] {
  return source.split(/\r?\n/).flatMap((line, index) => PATTERNS.filter(([pattern]) => pattern.test(line)).map(([, title]) => ({
    id: `unsafe-${file}-${index + 1}`, title, category: "unsafe-pattern" as const, severity: "medium" as const,
    message: "Potentially unsafe dynamic execution pattern detected.", confidence: 0.8,
    remediation: "Replace dynamic execution with explicit parsing or a constrained interpreter.",
    evidence: [{ file, line: index + 1, source: line.trim(), reason: title }],
  })));
}
