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
// Flattens a FindingWithContext into a notification-ready shape: one
// event per location, carrying just enough to jump straight to file+line
feat/editor-layer
// and show affected-file count. Consumers (apps/cli, apps/web) render
// this, they don't re-derive it from DiagnosticFinding/ImpactNavigationResult
// themselves.

// and show affected-file count.
ARCLUX.main

import type { FindingWithContext } from "./ErrorContext";
import type { DiagnosticSeverity } from "./DiagnosticEngine";

export interface DiagnosticEvent {
  checkId: string;
  severity: DiagnosticSeverity;
  message: string;
  moduleId: string;
  filePath: string;
  line: number;
  locationPrecision: "line" | "file";
  affectedFileCount: number;
}

export function toDiagnosticEvents(withContext: FindingWithContext): DiagnosticEvent[] {
  const { finding, impactByModuleId } = withContext;

  return finding.locations.map((loc) => ({
    checkId: finding.checkId,
    severity: finding.severity,
    message: finding.message,
    moduleId: loc.moduleId,
    filePath: loc.filePath,
    line: loc.line,
    locationPrecision: loc.locationPrecision,
    affectedFileCount: impactByModuleId[loc.moduleId]?.totalAffected ?? 0,
  }));
}

export function toDiagnosticEventsForAll(withContextList: FindingWithContext[]): DiagnosticEvent[] {
  return withContextList.flatMap(toDiagnosticEvents);
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

// Scaffold: diagnostics/DiagnosticEvent — not yet implemented
  ARCLUX.main
  ARCLUX.main
