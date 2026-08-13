feat/editor-layer

feat/diagnostics-layer
ARCLUX.main
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
import { getImpactNavigation, type ImpactNavigationResult } from "../editor/ImpactNavigator";
import type { DiagnosticFinding } from "./DiagnosticEngine";

export interface FindingWithContext {
  finding: DiagnosticFinding;
<<<<<< feat/editor-layer
  /** Impact for each distinct moduleId referenced in finding.locations. */

ARCLUX.main
  impactByModuleId: Record<string, ImpactNavigationResult>;
}

export function attachImpactContext(repository: Repository, finding: DiagnosticFinding): FindingWithContext {
  const uniqueModuleIds = [...new Set(finding.locations.map((loc) => loc.moduleId))];

  const impactByModuleId: Record<string, ImpactNavigationResult> = {};
  for (const moduleId of uniqueModuleIds) {
    impactByModuleId[moduleId] = getImpactNavigation(repository, moduleId);
  }

  return { finding, impactByModuleId };
}

export function attachImpactContextToAll(repository: Repository, findings: DiagnosticFinding[]): FindingWithContext[] {
  return findings.map((f) => attachImpactContext(repository, f));
}
feat/editor-layer


/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// Scaffold: diagnostics/ErrorContext — not yet implemented.
ARCLUX.main
ARCLUX.main
