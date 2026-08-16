// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Vulnerable-dependency detection: pinned (lockfile) versions are compared
// against a known-vulnerability database using a small dependency-free
// semver comparator.
//
// The built-in database (DEFAULT_KNOWN_VULNERABILITIES) is a deliberately
// SMALL, hand-maintained subset of well-known advisories. It is NOT a
// substitute for an external advisory feed (OSV/NVD/GitHub Advisory DB) —
// wiring one is a documented deferral. Entries are marked with their
// advisory id and must be verified before relying on them for gating.

import type { SecuritySeverity } from "../SecuritySeverity";
import type { SecurityFinding } from "../SecurityFinding";
import type { LockedDependency } from "./LockfileAnalyzer";

export interface KnownVulnerability {
  /** Package name as it appears in the lockfile (e.g. "lodash"). */
  name: string;
  /** Vulnerable when locked version < fixedVersion (semver). */
  fixedVersion: string;
  severity: SecuritySeverity;
  description: string;
  /** Advisory id, e.g. "CVE-2021-23337". */
  reference: string;
  cwe?: string[];
  owasp?: string[];
}

export interface VulnerableDependencyFinding {
  dependency: LockedDependency;
  vulnerability: KnownVulnerability;
}

/**
 * Minimal semver comparator (major.minor.patch, optional prerelease
 * ignored). Returns -1 | 0 | 1. Not a full semver implementation —
 * build metadata ("+...") is stripped, prerelease ordering is not
 * implemented (documented limitation).
 */
export function compareSemver(aRaw: string, bRaw: string): -1 | 0 | 1 {
  const a = aRaw.split("+")[0]!.split("-")[0]!;
  const b = bRaw.split("+")[0]!.split("-")[0]!;
  const aParts = a.split(".").map((p) => parseInt(p, 10) || 0);
  const bParts = b.split(".").map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

export function isVulnerable(lockedVersion: string, vulnerability: KnownVulnerability): boolean {
  return compareSemver(lockedVersion, vulnerability.fixedVersion) < 0;
}

/**
 * Built-in advisory subset — verify each entry against its advisory before
 * relying on it in a gate. Full advisory feed = documented deferral.
 */
export const DEFAULT_KNOWN_VULNERABILITIES: KnownVulnerability[] = [
  {
    name: "lodash",
    fixedVersion: "4.17.21",
    severity: "high",
    description: "Prototype pollution via zipObjectDeep / set / defaultToDeep (fixed in 4.17.21).",
    reference: "CVE-2021-23337",
    cwe: ["CWE-1321"],
    owasp: ["A03:2025"],
  },
  {
    name: "minimist",
    fixedVersion: "1.2.6",
    severity: "high",
    description: "Prototype pollution via constructor payload (fixed in 1.2.6).",
    reference: "CVE-2021-44906",
    cwe: ["CWE-1321"],
    owasp: ["A03:2025"],
  },
  {
    name: "ws",
    fixedVersion: "8.17.1",
    severity: "medium",
    description: "DoS via uncaught error on malformed close frame (fixed in 8.17.1).",
    reference: "CVE-2024-37890",
    cwe: ["CWE-400"],
    owasp: ["A03:2025"],
  },
  {
    name: "jsonwebtoken",
    fixedVersion: "9.0.0",
    severity: "high",
    description: "Unrestricted key type can lead to forged tokens (fixed in 9.0.0).",
    reference: "CVE-2022-23529",
    cwe: ["CWE-347"],
    owasp: ["A07:2025"],
  },
  {
    name: "next",
    fixedVersion: "12.0.9",
    severity: "high",
    description: "Improper input validation in i18n routing (fixed in 12.0.9).",
    reference: "CVE-2022-23649",
    cwe: ["CWE-20"],
    owasp: ["A05:2025"],
  },
];

export function detectVulnerableDependencies(
  locked: LockedDependency[],
  database: KnownVulnerability[] = DEFAULT_KNOWN_VULNERABILITIES
): VulnerableDependencyFinding[] {
  const byName = new Map<string, KnownVulnerability[]>();
  for (const vuln of database) {
    const list = byName.get(vuln.name) ?? [];
    list.push(vuln);
    byName.set(vuln.name, list);
  }

  const findings: VulnerableDependencyFinding[] = [];
  for (const dep of locked) {
    for (const vuln of byName.get(dep.name) ?? []) {
      if (isVulnerable(dep.version, vuln)) {
        findings.push({ dependency: dep, vulnerability: vuln });
        break; // one finding per dependency instance
      }
    }
  }
  return findings;
}

/** Converts vulnerable-dependency hits into the standard SecurityFinding shape. */
export function toSecurityFindings(hits: VulnerableDependencyFinding[]): SecurityFinding[] {
  return hits.map((hit) => {
    const { dependency, vulnerability } = hit;
    return {
      id: `vulnerable-dependency:${dependency.name}:${dependency.version}`,
      ruleId: "vulnerable-dependency",
      title: `Vulnerable dependency "${dependency.name}@${dependency.version}"`,
      description: `${vulnerability.description} (${vulnerability.reference}; fixed in ${vulnerability.fixedVersion}; depth ${dependency.depth}; ${dependency.manager} via ${dependency.lockfilePath}).`,
      severity: vulnerability.severity,
      confidence: "medium",
      location: { moduleId: dependency.lockfilePath, filePath: dependency.lockfilePath },
      cwe: vulnerability.cwe,
      owasp: vulnerability.owasp,
    };
  });
}
