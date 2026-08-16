// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Dependency risk analysis — the aggregate entry point of the dependency
// layer. Consumes the core engine's ManifestDependency[] (already part of
// AnalyzeRepositoryResult — nothing new to scan for manifests) plus the
// SourceProvider content channel for LOCKFILES (exact versions), and
// produces SecurityFinding[]:
//
//   1. vulnerable-dependency   — pinned version < fixedVersion in the
//                                known-vulnerability database (A03:2025)
//   2. unpinned-dependency     — runtime dependency declared with a range
//                                (^, ~, >=, *, latest) instead of an exact
//                                version — supply-chain risk heuristic
//
// The known-vulnerability database is deliberately small; an external
// advisory feed is a documented deferral (see VulnerableDependencyDetector).

import type { SourceProvider } from "../SourceProvider";
import type { SecuritySeverity } from "../SecuritySeverity";
import type { SecurityFinding } from "../SecurityFinding";
import type { ManifestDependency } from "../../parser/core/ManifestParserInterface";
import { parseLockfiles, type LockedDependency } from "./LockfileAnalyzer";
import {
  detectVulnerableDependencies,
  toSecurityFindings,
  type KnownVulnerability,
} from "./VulnerableDependencyDetector";
import { analyzeTransitiveRisk, type TransitiveRiskReport } from "./TransitiveRiskAnalyzer";

export interface DependencyRiskInput {
  /** Manifest-declared dependencies from the core pipeline (AnalyzeRepositoryResult.dependencies). */
  manifestDependencies: ManifestDependency[];
  sources: SourceProvider;
  /** Custom vulnerability database — replaces the default when provided. */
  vulnerabilities?: KnownVulnerability[];
}

export interface DependencyRiskResult {
  findings: SecurityFinding[];
  locked: LockedDependency[];
  transitiveRisk: TransitiveRiskReport;
}

/** True when the manifest spec is not an exact pinned version (^, ~, >=, *, latest, ...). */
export function isUnpinnedRange(versionRange: string | undefined): boolean {
  if (!versionRange || versionRange.trim() === "") return false;
  const trimmed = versionRange.trim();
  if (/^\d+\.\d+\.\d+$/.test(trimmed)) return false; // exact "1.2.3"
  if (/^v\d+\.\d+\.\d+$/.test(trimmed)) return false; // exact "v1.2.3"
  if (/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(trimmed)) return false; // exact with prerelease
  return true;
}

export function analyzeDependencyRisk(input: DependencyRiskInput): DependencyRiskResult {
  const locked = parseLockfiles(input.sources).dependencies;
  const vulnerabilityHits = detectVulnerableDependencies(locked, input.vulnerabilities);
  const transitiveRisk = analyzeTransitiveRisk(locked, vulnerabilityHits);

  const findings: SecurityFinding[] = [...toSecurityFindings(vulnerabilityHits)];

  // Heuristic: runtime deps declared with a range are a supply-chain risk
  // (the exact version is decided by the resolver, not the developer).
  for (const dep of input.manifestDependencies) {
    if (dep.kind !== "runtime") continue;
    if (!isUnpinnedRange(dep.versionRange)) continue;

    findings.push({
      id: `unpinned-dependency:${dep.name}`,
      ruleId: "unpinned-dependency",
      title: `Runtime dependency "${dep.name}" is not pinned to an exact version`,
      description: `Declared as "${dep.versionRange}" — the exact installed version is decided by the resolver. Pin to an exact version and use a lockfile.`,
      severity: "low" as SecuritySeverity,
      confidence: "high",
      location: { moduleId: "manifest", filePath: "manifest" },
      cwe: ["CWE-1104"], // Use of Unmaintained Third Party Components (supply-chain hygiene)
      owasp: ["A03:2025"],
    });
  }

  findings.sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.id.localeCompare(b.id));
  return { findings, locked, transitiveRisk };
}
