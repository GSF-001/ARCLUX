// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Rule-based, no external API. One static suggestion template per
// checkId, matching the checkIds DiagnosticEngine.ts actually produces.
// Adding a new detector adapter later: add its checkId here too.

import type { DiagnosticFinding } from "./DiagnosticEngine";

export interface FixSuggestion {
  checkId: string;
  suggestion: string;
}

const SUGGESTIONS: Record<string, string> = {
  circularDependency:
    "Break the cycle: extract the shared code both modules depend on into a separate module, or convert one edge to a lazy/dynamic import.",
  deadCode:
    "This file's exports are unused by any consumer. Either remove the unused exports, or if it's imported only for a side effect, document that explicitly.",
  ambiguousSymbolResolution:
    "Rename one of the colliding symbols, or move the non-source definition (test/example/fixture/mock) so it's clearly distinguishable from the real source definition.",
};

export function getFixSuggestion(finding: DiagnosticFinding): FixSuggestion | null {
  const suggestion = SUGGESTIONS[finding.checkId];
  if (!suggestion) return null;
  return { checkId: finding.checkId, suggestion };
}

export function getFixSuggestions(findings: DiagnosticFinding[]): FixSuggestion[] {
  return findings
    .map(getFixSuggestion)
    .filter((s): s is FixSuggestion => s !== null);
}
