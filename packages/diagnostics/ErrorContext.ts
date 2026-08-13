// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Connects a DiagnosticFinding to its blast radius, by wrapping
// packages/editor/ImpactNavigator.ts (which itself wraps packages/impact/*).
// Does not recompute impact -- reuses the existing chain end to end.

import type { Repository } from "../repository/Repository";
import { getImpactCount } from "../editor/ImpactNavigator";
import type { DiagnosticFinding } from "./DiagnosticEngine";

export interface FindingWithContext {
  finding: DiagnosticFinding;

  /** Affected-file count for each distinct moduleId referenced in finding.locations. */
  impactByModuleId: Record<string, number>;
}

export function attachImpactContext(
  repository: Repository,
  finding: DiagnosticFinding,
  cache: Map<string, number> = new Map(),
): FindingWithContext {
  const uniqueModuleIds = [
    ...new Set(finding.locations.map((loc) => loc.moduleId)),
  ];

  const impactByModuleId: Record<string, number> = {};

  for (const moduleId of uniqueModuleIds) {
    let count = cache.get(moduleId);
    if (count === undefined) {
      count = getImpactCount(repository, moduleId);
      cache.set(moduleId, count);
    }
    impactByModuleId[moduleId] = count;
  }

  return { finding, impactByModuleId };
}

export function attachImpactContextToAll(
  repository: Repository,
  findings: DiagnosticFinding[],
): FindingWithContext[] {
  // Shared cache across all findings in this run, and only the affected-file
  // COUNT is kept per moduleId (not the full ImpactNavigationResult, which
  // includes a materialized affected-files array and a full impact tree --
  // neither used by diagnose's output). On Django (~989 unique moduleIds
  // across 650 findings), retaining the full result per moduleId caused an
  // out-of-memory crash; retaining just numbers does not.
  const cache = new Map<string, number>();
  return findings.map((f) => attachImpactContext(repository, f, cache));
}
