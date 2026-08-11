// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// LAB 4 — Stable Core Contract.
//
// Problem this solves: verify.ts (LAB 2) imports 10 individual detector
// functions + RuleEngine directly. Every future consumer (API, IDE, CI)
// would have to redo that same wiring. This file is the one place that
// wiring happens -- consumers call runAllChecks(repository) and get
// back a single Issue[] list, not 10 separate imports to keep in sync.
//
// Scope: this is ONLY the contract + aggregation function. It does NOT
// change verify.ts/diff.ts's own behavior or the underlying detectors --
// see LAB 5 for formalizing the CLI -> Engine -> Core boundary itself.

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
import { runRules } from "../rules/RuleEngine";
import { requirePage } from "../rules/nextjs/requirePage";

/** Severity that a single Issue carries. "error" should fail a build/CI check, "warning" should not. */
export type IssueSeverity = "error" | "warning";

/** One normalized finding, regardless of whether it came from a detector or a rule. */
export interface Issue {
  source: "detector" | "rule";
  /** e.g. "circularDependency", "unusedExports", "requirePage" */
  checkId: string;
  severity: IssueSeverity;
  message: string;
}

export interface RunAllChecksResult {
  issues: Issue[];
  errorCount: number;
  warningCount: number;
  /** true if there are zero errors. Warnings alone don't fail. */
  passed: boolean;
}

/**
 * Runs the same 10 detectors doctor.ts/verify.ts already run, plus the
 * rule engine (currently only requirePage.ts is real -- see that file's
 * own comment; the other 12 rule stubs are NOT wired in here on purpose).
 * Returns one normalized Issue[] list instead of 10 separate detector
 * outputs + a separate rule engine result.
 */
export function runAllChecks(repository: Repository): RunAllChecksResult {
  const issues: Issue[] = [];

  const detectorRuns: Array<[string, () => { length: number } | unknown[]]> = [
    ["circularDependency", () => detectCircularDependency(repository)],
    ["unusedExports", () => detectUnusedExports(repository)],
    ["orphanFiles", () => detectOrphanFiles(repository)],
    ["largeModules", () => detectLargeModules(repository)],
    ["duplicateModules", () => detectDuplicateModules(repository)],
    ["sharedModules", () => detectSharedModules(repository)],
    ["indexFiles", () => detectIndexFiles(repository)],
    ["layerViolation", () => detectLayerViolation(repository)],
    ["deadCode", () => detectDeadCode(repository)],
    ["ambiguousSymbolResolution", () => detectAmbiguousSymbolResolution(repository)],
  ];

  for (const [checkId, run] of detectorRuns) {
    const findings = run() as unknown[];
    for (const _finding of findings) {
      issues.push({
        source: "detector",
        checkId,
        severity: "error",
        message: `${checkId} finding (see detector output for detail)`,
      });
    }
  }

  const ruleResults = runRules(repository, [requirePage], repository.meta.detectedFrameworks);
  for (const result of ruleResults) {
    issues.push({
      source: "rule",
      checkId: result.ruleId ?? "unknown",
      severity: result.severity === "error" ? "error" : "warning",
      message: result.message,
    });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    issues,
    errorCount,
    warningCount,
    passed: errorCount === 0,
  };
}
