// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Shared contract types for the security-analysis package. This file is
// deliberately logic-free: detectors (source/), architecture analyzers
// (architecture/) and reporters (reporting/) all import these shapes, and
// so do consumers in packages/correlation and packages/remote (RemoteSnapshot
// carries SecurityFinding[]). Keeping the types here, rather than in each
// package, is what lets correlation and remote depend on security-analysis
// WITHOUT creating an import cycle.

/**
 * Severity taxonomy follows the Semgrep model (LOW/MEDIUM/HIGH/CRITICAL),
 * verified against Semgrep's rule-syntax docs (2026-08-16). Maps to SARIF
 * level as: critical/high -> error, medium -> warning, low -> note.
 */
export type SecuritySeverity = "critical" | "high" | "medium" | "low";

/** How sure the detector is that the finding is a real vulnerability, not a false positive. */
export type SecurityConfidence = "high" | "medium" | "low";

/** A position in the analyzed repository. Line/column are 1-based, optional (file-level findings). */
export interface SecurityLocation {
  /** ModuleInfo id — usually the relative path. */
  moduleId: string;
  /** Relative path, POSIX-style. */
  filePath: string;
  /** 1-based line number. Absent for file-level findings. */
  line?: number;
  /** 1-based column number. Absent when unknown. */
  column?: number;
}

/**
 * One normalized security finding. Shape is intentionally richer than the
 * core engine's Issue (engine/contract.ts) — the core contract stays
 * untouched; this is the security pipeline's own extension type.
 */
export interface SecurityFinding {
  /**
   * Deterministic fingerprint: `${ruleId}:${filePath}:${line ?? "file"}`.
   * Stable across runs — the key for dedup (FindingCorrelator) and for
   * baselines (like gitleaks' fingerprint, verified 2026-08-16).
   */
  id: string;
  /** Stable rule identifier, e.g. "hardcoded-api-key" or "unsafe-eval". */
  ruleId: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  confidence: SecurityConfidence;
  location: SecurityLocation;
  /** MITRE CWE identifiers, e.g. ["CWE-798"]. */
  cwe?: string[];
  /** OWASP Top 10:2025 identifiers, e.g. ["A03:2025"]. */
  owasp?: string[];
  /** How to fix it. Populated by reporting/RemediationSuggestion templates. */
  remediation?: RemediationSuggestion;
  /** Links this finding to a ProvenanceRecord (packages/provenance). */
  provenanceId?: string;
}

/** Fix guidance attached to a finding (Semgrep fix-style, but never auto-applied). */
export interface RemediationSuggestion {
  /** One-line actionable summary, e.g. "Move the secret to an environment variable." */
  summary: string;
  /** Longer explanation of why this fixes the weakness. */
  detail?: string;
  /** A literal replacement hint for the matched code region. */
  fixHint?: string;
}

/**
 * Content channel for content-based detectors (secrets, unsafe patterns).
 *
 * ARCLUX's Repository deliberately does NOT carry file contents (verified
 * in buildIndex.ts: content is read, used for resolveSameScopeDependencies,
 * then discarded). Detectors that need the raw text take a SourceProvider
 * as an explicit extension input — the file LIST still comes from the
 * Repository, so detectors never re-scan the filesystem themselves.
 */
export interface SourceProvider {
  /** Returns the file content, or null when the path is unknown/unreadable. */
  read(relativePath: string): string | null;
}
