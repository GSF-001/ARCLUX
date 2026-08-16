// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Security impact analysis: given a vulnerable module, how many consumers
// are affected if it changes/fixed, and what is the consumer tree? Wraps
// the core impact package (buildImpactTree, calculateAffectedFiles) WITHOUT
// modifying it — this is the security layer's own view over the stable
// impact contract.

import type { Repository } from "../../repository/Repository";
import { buildImpactTree, type ImpactTreeNode } from "../../impact/buildImpactTree";
import { calculateAffectedFiles } from "../../impact/calculateAffectedFiles";
import type { SecurityFinding } from "../SecurityFinding";

export interface SecurityImpactReport {
  moduleId: string;
  filePath: string;
  /** Module not found in the repository. */
  notFound: boolean;
  /** Direct consumers + transitive consumers, via impact/calculateAffectedFiles. */
  totalAffected: number;
  /** Consumer tree via impact/buildImpactTree (importedBy direction). */
  consumerTree: ImpactTreeNode | null;
  /** The findings located in this module (passed through, not re-derived). */
  findings: SecurityFinding[];
}

export interface ImpactedFinding extends SecurityFinding {
  /** Impact report for the finding's module. */
  impact: SecurityImpactReport;
}

export function analyzeSecurityImpact(repository: Repository, moduleId: string, findings: SecurityFinding[] = []): SecurityImpactReport {
  const module = repository.getModule(moduleId);
  const affected = calculateAffectedFiles(repository, moduleId);

  return {
    moduleId,
    filePath: module?.file.relativePath ?? moduleId,
    notFound: affected.notFound,
    totalAffected: affected.totalAffected,
    consumerTree: buildImpactTree(repository, moduleId),
    findings: findings.filter((f) => f.location.moduleId === moduleId),
  };
}

/** Attaches an impact report to every finding that has a location module. */
export function attachImpactToFindings(repository: Repository, findings: SecurityFinding[]): ImpactedFinding[] {
  return findings.map((finding) => ({
    ...finding,
    impact: analyzeSecurityImpact(repository, finding.location.moduleId, [finding]),
  }));
}
