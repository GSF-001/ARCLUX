// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * AnalysisBoundary — decides HOW BIG or HOW DEEP an analysis may go.
 *
 * Limits are policy; the two checks that always apply are hygiene:
 *   1. Paths that can never be analyzed (node_modules, .git, vendor —
 *      the same set the indexer's scan ignores).
 *   2. The configured hard caps (files/bytes/modules), checked against a
 *      scan summary AFTER a scan so the shell/CLI can report violations
 *      without having to predict them.
 */

export interface AnalysisBoundaryViolation {
  reason: string;
  detail?: string;
}

export interface AnalysisBoundaryOptions {
  maxFiles?: number;
  maxBytes?: number;
  maxModules?: number;
  /** Additional path segments always rejected (besides node_modules/.git). */
  extraDeniedSegments?: string[];
}

export interface ScanFacts {
  filesScanned: number;
  filesParsed: number;
  moduleCount: number;
  totalBytes?: number;
}

const ALWAYS_DENIED_SEGMENTS = ["node_modules", ".git", "vendor"];

export class AnalysisBoundary {
  private readonly maxFiles: number;
  private readonly maxBytes: number;
  private readonly maxModules: number;
  private readonly deniedSegments: string[];

  constructor(options: AnalysisBoundaryOptions = {}) {
    this.maxFiles = options.maxFiles ?? 100_000;
    this.maxBytes = options.maxBytes ?? 2 * 1024 * 1024 * 1024;
    this.maxModules = options.maxModules ?? 100_000;
    this.deniedSegments = [...ALWAYS_DENIED_SEGMENTS, ...(options.extraDeniedSegments ?? [])];
  }

  /** True when a path contains a segment that can never be analyzed. */
  isDeniedPath(path: string): boolean {
    return this.deniedSegments.some((segment) => path.split("/").includes(segment));
  }

  /** Checks a scan summary against the configured caps. */
  checkScan(facts: ScanFacts): AnalysisBoundaryViolation[] {
    const violations: AnalysisBoundaryViolation[] = [];

    if (facts.filesScanned > this.maxFiles) {
      violations.push({
        reason: `scan exceeds maxFiles (${facts.filesScanned} > ${this.maxFiles})`,
      });
    }
    if (facts.totalBytes !== undefined && facts.totalBytes > this.maxBytes) {
      violations.push({
        reason: `scan exceeds maxBytes (${facts.totalBytes} > ${this.maxBytes})`,
      });
    }
    if (facts.moduleCount > this.maxModules) {
      violations.push({
        reason: `repository exceeds maxModules (${facts.moduleCount} > ${this.maxModules})`,
      });
    }

    return violations;
  }
}