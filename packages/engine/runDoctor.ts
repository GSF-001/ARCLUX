// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Server-side detector suite, normalized to one flat finding list — the
// HTTP counterpart of `arclux doctor` (apps/cli/doctor.ts prints the same
// detectors to a terminal; this module feeds /api/doctor and anything
// else that needs detector findings as data, not text).
//
// Runs ALL 19 detectors. Each detector's native finding shape is mapped
// to a DoctorFinding { checkId, severity, filePath?, message }. Severity
// is assigned per detector family (structural problems = error, hygiene/
// conventions = warning, informational classifiers = info); ambiguous
// symbols carry their own per-finding severity.

import type { Repository } from "../repository/Repository";
import { detectCircularDependency } from "../detectors/detectCircularDependency";
import { detectUnusedExports } from "../detectors/detectUnusedExports";
import { detectOrphanFiles } from "../detectors/detectOrphanFiles";
import { detectLargeModules } from "../detectors/detectLargeModules";
import { detectDuplicateModules } from "../detectors/detectDuplicateModules";
import { detectSharedModules } from "../detectors/detectSharedModules";
import { detectIndexFiles } from "../detectors/detectIndexFiles";
import { detectLayerViolation } from "../detectors/detectLayerViolation";
import { detectDeadCode } from "../detectors/detectDeadCode";
import { detectAmbiguousSymbolResolution } from "../detectors/detectAmbiguousSymbolResolution";
import { detectComponentConvention } from "../detectors/detectComponentConvention";
import { detectFeatureStructure } from "../detectors/detectFeatureStructure";
import { detectMissingExports } from "../detectors/detectMissingExports";
import { detectRepositoryPattern } from "../detectors/detectRepositoryPattern";
import { detectRouteConvention } from "../detectors/detectRouteConvention";
import { detectStoryConvention } from "../detectors/detectStoryConvention";
import { detectTestConvention } from "../detectors/detectTestConvention";
import { detectUnusedFiles } from "../detectors/detectUnusedFiles";
import { detectEntryPoints } from "../detectors/detectEntryPoints";

export type DoctorSeverity = "error" | "warning" | "info";

export interface DoctorFinding {
  checkId: string;
  severity: DoctorSeverity;
  /** Best-effort location: filePath, featurePath, or cycle string. */
  filePath?: string;
  message: string;
}

export interface RunDoctorResult {
  findings: DoctorFinding[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/**
 * A user-space detector: same contract as the 19 built-in detectors, but
 * loaded from a file (see packages/shell/detectors.ts). ARCLUX ships with
 * the built-in suite; anything a team wants that the suite doesn't cover
 * is written as a file, not a core change — mechanism, not policy.
 */
export interface UserDetector {
  checkId: string;
  severity: DoctorSeverity;
  /** Runs against the analyzed repository; returns zero or more findings. */
  run(repository: Repository): Array<{ filePath?: string; message: string }>;
}

export interface RunDoctorOptions {
  /** Extra detectors run AFTER the built-in suite, wrapped in safeRun. */
  extraDetectors?: UserDetector[];
}

/**
 * Runs one detector, isolating crashes (structural-death guard): if a
 * detector throws, the suite keeps going and the failure is surfaced as
 * an error finding instead of silently killing the whole run. A detector
 * that dies on every input would otherwise look like "no findings".
 * Exported for direct unit testing of the isolation contract.
 */
export function safeRun(
  checkId: string,
  severity: DoctorSeverity,
  run: () => void,
  findings: DoctorFinding[]
): void {
  try {
    run();
  } catch (err) {
    findings.push({
      checkId,
      severity,
      message: `DETECTOR CRASHED: ${err instanceof Error ? err.message : String(err)} — findings for this check are unreliable.`,
    });
  }
}

/** Location of a convention finding, mirroring doctor.ts's selection order. */
function locationOf(f: Record<string, unknown>): string | undefined {
  if ("filePath" in f && typeof f.filePath === "string") return f.filePath;
  if ("featurePath" in f && typeof f.featurePath === "string") return f.featurePath;
  if ("cycle" in f && Array.isArray(f.cycle)) return (f.cycle as string[]).join(" \u2192 ");
  return undefined;
}

export function runDoctor(repository: Repository, options: RunDoctorOptions = {}): RunDoctorResult {
  const findings: DoctorFinding[] = [];

  // Every detector is wrapped in safeRun — a detector that throws must
  // not silently kill the suite or look like "no findings" (structural
  // death guard, OWP §4.1 lens; see safeRun above).

  // ── error: structural problems ──────────────────────────────
  safeRun("circularDependency", "error", () => {
    for (const c of detectCircularDependency(repository)) {
      findings.push({
        checkId: "circularDependency",
        severity: "error",
        message: c.cycle.join(" \u2192 "),
      });
    }
  }, findings);
  safeRun("unusedExports", "error", () => {
    for (const f of detectUnusedExports(repository)) {
      findings.push({
        checkId: "unusedExports",
        severity: "error",
        filePath: f.filePath,
        message: `${f.exportName} (${f.exportKind}, line ${f.line}) \u2014 ${f.message}`,
      });
    }
  }, findings);
  safeRun("orphanFiles", "error", () => {
    for (const f of detectOrphanFiles(repository)) {
      findings.push({
        checkId: "orphanFiles",
        severity: "error",
        filePath: f.filePath,
        message: f.message,
      });
    }
  }, findings);
  safeRun("layerViolation", "error", () => {
    for (const f of detectLayerViolation(repository)) {
      findings.push({
        checkId: "layerViolation",
        severity: "error",
        filePath: f.filePath,
        message: `imports ${f.importedFilePath} [${f.ruleName}] at line ${f.line} \u2014 ${f.message}`,
      });
    }
  }, findings);
  safeRun("ambiguousSymbolResolution", "error", () => {
    for (const f of detectAmbiguousSymbolResolution(repository)) {
      findings.push({
        checkId: "ambiguousSymbolResolution",
        severity: f.severity === "high" ? "error" : "warning",
        message: `${f.symbolName} — ${f.reason}; definitions: ${f.definitions
          .map((d) => `${d.modulePath}:${d.line} (${d.category})`)
          .join(", ")}`,
      });
    }
  }, findings);

  // ── warning: hygiene / conventions ──────────────────────────
  safeRun("largeModules", "warning", () => {
    for (const f of detectLargeModules(repository)) {
      findings.push({
        checkId: "largeModules",
        severity: "warning",
        filePath: f.filePath,
        message: `${f.sizeBytes.toLocaleString()} bytes \u2014 ${f.message}`,
      });
    }
  }, findings);
  safeRun("duplicateModules", "warning", () => {
    for (const g of detectDuplicateModules(repository)) {
      findings.push({
        checkId: "duplicateModules",
        severity: "warning",
        message: `${g.filePaths.join(", ")} (${g.sizeBytes.toLocaleString()} bytes each)`,
      });
    }
  }, findings);
  safeRun("indexFiles", "warning", () => {
    for (const f of detectIndexFiles(repository)) {
      findings.push({
        checkId: "indexFiles",
        severity: f.isPureBarrel ? "info" : "warning",
        filePath: f.filePath,
        message: f.message,
      });
    }
  }, findings);
  safeRun("deadCode", "warning", () => {
    for (const f of detectDeadCode(repository)) {
      findings.push({
        checkId: "deadCode",
        severity: "warning",
        filePath: f.filePath,
        message: `${f.unusedExportCount} unused export(s), imported by ${f.importedByCount} \u2014 ${f.message}`,
      });
    }
  }, findings);

  const conventionDetectors: Array<{ checkId: string; run: () => unknown[] }> = [
    { checkId: "componentConvention", run: () => detectComponentConvention(repository) },
    { checkId: "featureStructure", run: () => detectFeatureStructure(repository) },
    { checkId: "missingExports", run: () => detectMissingExports(repository) },
    { checkId: "repositoryPattern", run: () => detectRepositoryPattern(repository) },
    { checkId: "routeConvention", run: () => detectRouteConvention(repository) },
    { checkId: "storyConvention", run: () => detectStoryConvention(repository) },
    { checkId: "testConvention", run: () => detectTestConvention(repository) },
    { checkId: "unusedFiles", run: () => detectUnusedFiles(repository) },
  ];
  for (const { checkId, run } of conventionDetectors) {
    safeRun(checkId, "warning", () => {
      for (const finding of run()) {
        const f = finding as Record<string, unknown>;
        findings.push({
          checkId,
          severity: "warning",
          filePath: locationOf(f),
          message: typeof f.message === "string" ? f.message : JSON.stringify(finding),
        });
      }
    }, findings);
  }

  // ── info: informational classifiers ─────────────────────────
  for (const f of detectSharedModules(repository)) {
    findings.push({
      checkId: "sharedModules",
      severity: "info",
      filePath: f.filePath,
      message: `imported by ${f.importerCount} \u2014 ${f.message}`,
    });
  }
  for (const f of detectEntryPoints(repository)) {
    findings.push({
      checkId: "entryPoints",
      severity: "info",
      filePath: f.filePath,
      message: f.reason,
    });
  }

  // ── user-space detectors ────────────────────────────────────
  // Same isolation contract as the built-ins: a crashing user detector
  // surfaces as an error finding instead of killing the suite.
  for (const detector of options.extraDetectors ?? []) {
    safeRun(detector.checkId, detector.severity, () => {
      for (const finding of detector.run(repository)) {
        findings.push({
          checkId: detector.checkId,
          severity: detector.severity,
          filePath: finding.filePath,
          message: finding.message,
        });
      }
    }, findings);
  }

  return {
    findings,
    errorCount: findings.filter((f) => f.severity === "error").length,
    warningCount: findings.filter((f) => f.severity === "warning").length,
    infoCount: findings.filter((f) => f.severity === "info").length,
  };
}
