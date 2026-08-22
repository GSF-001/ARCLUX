// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Health score — Phase 2 from progres/roadmap.md: turn the flat detector
// list into a diagnosis. Four categories, each scored 0..100 from its
// detector findings, normalized by module count so big repos aren't
// punished for size alone.
//
// Formula (deterministic, no magic): every finding costs severity weight
// (error=5, warning=2, info=0.5). A category's raw penalty is divided by
// module count and scaled — 1 penalty point per module == 0 points on
// that axis, zero findings == 100. Overall is the unweighted mean.

import type { DoctorFinding } from "./runDoctor";

export interface HealthCategory {
  id: string;
  label: string;
  /** 0..100, rounded to one decimal */
  score: number;
  /** findings that fed into this category */
  findingCount: number;
}

export interface HealthScore {
  overall: number;
  categories: HealthCategory[];
  moduleCount: number;
}

const SEVERITY_WEIGHT: Record<DoctorFinding["severity"], number> = {
  error: 5,
  warning: 2,
  info: 0.5,
};

const CATEGORY_CHECKS: { id: string; label: string; checkIds: string[] }[] = [
  {
    id: "structuralIntegrity",
    label: "Structural integrity",
    checkIds: ["largeModules", "duplicateModules", "indexFiles", "missingExports"],
  },
  {
    id: "dependencyHygiene",
    label: "Dependency hygiene",
    checkIds: ["circularDependency", "unusedExports", "orphanFiles", "orphanIntegration", "unusedFiles", "deadCode"],
  },
  {
    id: "layerConsistency",
    label: "Layer consistency",
    checkIds: ["layerViolation", "ambiguousSymbolResolution"],
  },
  {
    id: "conventionCompliance",
    label: "Convention compliance",
    checkIds: ["componentConvention", "featureStructure", "repositoryPattern", "routeConvention", "storyConvention", "testConvention"],
  },
];

function scoreFor(findings: DoctorFinding[], moduleCount: number): number {
  if (findings.length === 0) return 100;
  const penalty = findings.reduce((sum, f) => sum + (SEVERITY_WEIGHT[f.severity] ?? 1), 0);
  const normalized = penalty / Math.max(moduleCount, 1);
  // 1 full penalty point per module bottoms out at 0.
  return Math.max(0, Math.round((1 - Math.min(normalized, 1)) * 1000) / 10);
}

export function computeHealthScore(
  findings: DoctorFinding[],
  moduleCount: number
): HealthScore {
  const categories = CATEGORY_CHECKS.map(({ id, label, checkIds }) => {
    const own = findings.filter((f) => checkIds.includes(f.checkId));
    return { id, label, score: scoreFor(own, moduleCount), findingCount: own.length };
  });
  const overall =
    Math.round((categories.reduce((sum, c) => sum + c.score, 0) / categories.length) * 10) / 10;
  return { overall, categories, moduleCount };
}