// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Transitive-risk analysis over pinned dependencies. For npm lockfiles
// the LockfileAnalyzer already marks depth (1 = direct, 2+ = transitive);
// other managers report everything at depth 1 (no graph in the lockfile
// format — documented limitation). This analyzer computes the aggregate
// picture: how much of the dependency tree is transitive, and which
// vulnerable hits are direct (developer-controlled, higher risk) vs
// transitive (indirect, harder to fix).

import type { LockedDependency } from "./LockfileAnalyzer";
import type { VulnerableDependencyFinding } from "./VulnerableDependencyDetector";

export interface TransitiveRiskReport {
  totalDirect: number;
  totalTransitive: number;
  /** 1 for lockfiles without nesting (non-npm), max nesting depth otherwise. */
  maxDepth: number;
  /** Vulnerable hits that are direct dependencies (depth 1). */
  vulnerableDirect: VulnerableDependencyFinding[];
  /** Vulnerable hits that are transitive (depth 2+). */
  vulnerableTransitive: VulnerableDependencyFinding[];
  /**
   * Heuristic 0..1: fraction of the tree that is transitive. Higher means
   * more of the supply chain is outside the developer's direct control.
   */
  transitiveRatio: number;
}

export function analyzeTransitiveRisk(
  locked: LockedDependency[],
  vulnerable: VulnerableDependencyFinding[]
): TransitiveRiskReport {
  const totalDirect = locked.filter((d) => d.depth === 1).length;
  const totalTransitive = locked.filter((d) => d.depth > 1).length;
  const maxDepth = locked.reduce((max, d) => Math.max(max, d.depth), locked.length > 0 ? 1 : 0);

  const vulnIds = new Set(vulnerable.map((v) => `${v.dependency.name}@${v.dependency.version}`));
  const vulnerableDirect = vulnerable.filter((v) => v.dependency.depth === 1);
  const vulnerableTransitive = vulnerable.filter((v) => v.dependency.depth > 1);

  return {
    totalDirect,
    totalTransitive,
    maxDepth,
    vulnerableDirect,
    vulnerableTransitive,
    transitiveRatio: totalDirect + totalTransitive > 0 ? totalTransitive / (totalDirect + totalTransitive) : 0,
  };
}

/** Convenience: find the vulnerable dependency records a report references. */
export function vulnerableNames(report: TransitiveRiskReport): string[] {
  return [...new Set([...report.vulnerableDirect, ...report.vulnerableTransitive].map((v) => v.dependency.name))].sort();
}
