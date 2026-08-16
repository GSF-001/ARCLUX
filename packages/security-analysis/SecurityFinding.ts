// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// The security finding contract: one normalized security finding plus its
// location and remediation hint. Shape is intentionally richer than the
// core engine's Issue (engine/contract.ts) — the core contract stays
// untouched; this is the security pipeline's own extension type.

import type { SecuritySeverity, SecurityConfidence } from "./SecuritySeverity";

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
 * One normalized security finding.
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
