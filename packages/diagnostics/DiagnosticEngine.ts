// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Wraps packages/detectors/* -- does not reimplement detection logic.
// Each detector has a genuinely different native shape (confirmed by
// reading the actual source, not assumed), so each gets its own adapter
// function translating it into the shared ErrorLocation shape. Adding a
// detector here later: read its actual return type first (cat the file),
// don't guess the shape from its name.

import type { Repository } from "../repository/Repository";
import { detectCircularDependency } from "../detectors/detectCircularDependency";
import { detectDeadCode } from "../detectors/detectDeadCode";
import { detectAmbiguousSymbolResolution } from "../detectors/detectAmbiguousSymbolResolution";
import { fileLevelLocation, preciseLocation, type ErrorLocation } from "./ErrorLocation";

export type DiagnosticSeverity = "error" | "warning";

export interface DiagnosticFinding {
  checkId: string;
  severity: DiagnosticSeverity;
  message: string;
  locations: ErrorLocation[];
}

function adaptCircularDependency(repository: Repository): DiagnosticFinding[] {
  const results = detectCircularDependency(repository);

  return results.map((r) => ({
    checkId: "circularDependency",
    severity: "error" as const,
    message: `Circular dependency: ${r.cycle.join(" -> ")}`,
    locations: r.cycle.map((moduleId) => {
      const mod = repository.getModule(moduleId);
      return fileLevelLocation(moduleId, mod?.file.relativePath ?? moduleId);
    }),
  }));
}

function adaptDeadCode(repository: Repository): DiagnosticFinding[] {
  const results = detectDeadCode(repository);

  return results.map((r) => {
    const mod = repository.getAllModules().find((m) => m.file.relativePath === r.filePath);
    return {
      checkId: "deadCode",
      severity: "warning" as const,
      message: r.message,
      locations: [fileLevelLocation(mod?.id ?? r.filePath, r.filePath)],
    };
  });
}

function adaptAmbiguousSymbolResolution(repository: Repository): DiagnosticFinding[] {
  const results = detectAmbiguousSymbolResolution(repository);

  return results.map((r) => ({
    checkId: "ambiguousSymbolResolution",
    severity: r.severity === "high" ? ("error" as const) : ("warning" as const),
    message: `Symbol "${r.symbolName}": ${r.reason}`,
    locations: r.definitions.map((d) => preciseLocation(d.moduleId, d.modulePath, d.line)),
  }));
}

export function runDiagnostics(repository: Repository): DiagnosticFinding[] {
  return [
    ...adaptCircularDependency(repository),
    ...adaptDeadCode(repository),
    ...adaptAmbiguousSymbolResolution(repository),
  ];
}
