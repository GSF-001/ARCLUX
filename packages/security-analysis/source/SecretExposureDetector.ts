// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Secret detection modeled on gitleaks (verified against gitleaks README,
// 2026-08-16: regex + keyword pre-filter + Shannon entropy + allowlists +
// inline "gitleaks:allow" + baseline fingerprint). This is a REIMPLEMENTATION
// against ARCLUX's own types, not a code port (see CONTRIBUTING.md "Adapting
// code from other open-source projects").
//
// Pipeline per file:
//   1. source.read(relativePath) — the SourceProvider content channel;
//      files whose content is unavailable are skipped (Repository carries
//      no content, see packages/security-analysis/types.ts)
//   2. line loop: skip lines containing "gitleaks:allow"
//   3. keyword pre-filter (rules with keywords only run on matching lines)
//   4. regex match + optional Shannon entropy threshold on the secret group
//   5. stopwords + path allowlist

import type { Repository } from "../../repository/Repository";
import type { ModuleInfo } from "../../shared/types";
import type { SecurityFinding, SecuritySeverity, SourceProvider } from "../types";

export interface SecretRule {
  /** Stable rule id, e.g. "aws-access-key". */
  id: string;
  /** Human-readable rule description. */
  description: string;
  /** Matcher over one line of content. */
  regex: RegExp;
  /** Capture group holding the secret itself; 0 = whole match (default). */
  secretGroup?: number;
  /** Minimum Shannon entropy of the secret; below it the match is dropped. */
  entropy?: number;
  /** Keyword pre-filter — the line must contain at least one of these. */
  keywords?: string[];
  /** If the extracted secret contains any stopword, the match is dropped. */
  stopwords?: string[];
  severity: SecuritySeverity;
  title: string;
  cwe?: string[];
  owasp?: string[];
}

export interface SecretDetectionOptions {
  /** Custom rules — replaces the default set when provided. */
  rules?: SecretRule[];
  /** Regexes against the relative path; matching modules are skipped. */
  allowlistPaths?: RegExp[];
}

/** Shannon entropy in bits per character — high for random-looking secrets. */
export function shannonEntropy(value: string): number {
  if (value.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export const DEFAULT_SECRET_RULES: SecretRule[] = [
  {
    id: "aws-access-key",
    description: "AWS Access Key ID (AKIA...)",
    regex: /AKIA[0-9A-Z]{16}/,
    entropy: 3.5,
    keywords: ["AKIA"],
    severity: "high",
    title: "Hardcoded AWS Access Key ID",
    cwe: ["CWE-798"],
    owasp: ["A03:2025"],
  },
  {
    id: "api-key-prefixed",
    description: "Prefixed API key (sk-...)",
    regex: /sk-[A-Za-z0-9_-]{20,}/,
    entropy: 3.0,
    keywords: ["sk-"],
    severity: "high",
    title: "Hardcoded prefixed API key",
    cwe: ["CWE-798"],
    owasp: ["A03:2025"],
  },
  {
    id: "github-personal-access-token",
    description: "GitHub personal access token (ghp_...)",
    regex: /ghp_[A-Za-z0-9]{36}/,
    keywords: ["ghp_"],
    severity: "critical",
    title: "Hardcoded GitHub personal access token",
    cwe: ["CWE-798"],
    owasp: ["A03:2025"],
  },
  {
    id: "private-key-block",
    description: "Private key block (RSA/EC/OPENSSH/DSA)",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    severity: "critical",
    title: "Embedded private key block",
    cwe: ["CWE-798"],
    owasp: ["A03:2025"],
  },
  {
    id: "generic-password-assignment",
    description: "Password/secret assigned a literal string",
    regex: /(?:password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i,
    entropy: 2.5,
    keywords: ["password", "passwd", "pwd", "secret", "api_key", "api-key", "apikey"],
    stopwords: ["example", "test", "fake", "local-dev-only", "changeme"],
    severity: "medium",
    title: "Hardcoded credential assignment",
    cwe: ["CWE-798"],
    owasp: ["A03:2025"],
  },
];

const INLINE_ALLOW_MARKER = "gitleaks:allow";

export function detectSecretExposure(
  repository: Repository,
  sources: SourceProvider,
  options: SecretDetectionOptions = {}
): SecurityFinding[] {
  const rules = options.rules ?? DEFAULT_SECRET_RULES;
  const findings: SecurityFinding[] = [];

  for (const module of repository.getAllModules()) {
    const relativePath = module.file.relativePath;
    if (options.allowlistPaths?.some((re) => re.test(relativePath))) continue;

    const content = sources.read(relativePath);
    if (content === null) continue; // no content channel -> skip (structural detector's problem, not ours)

    findings.push(...detectInContent(module, relativePath, content, rules));
  }

  return findings.sort(
    (a, b) =>
      a.location.filePath.localeCompare(b.location.filePath) ||
      (a.location.line ?? 0) - (b.location.line ?? 0) ||
      a.ruleId.localeCompare(b.ruleId)
  );
}

function detectInContent(
  module: ModuleInfo,
  relativePath: string,
  content: string,
  rules: SecretRule[]
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(INLINE_ALLOW_MARKER)) continue;

    for (const rule of rules) {
      const secret = extractSecret(line, rule);
      if (secret === null) continue;

      findings.push({
        id: `${rule.id}:${relativePath}:${i + 1}`,
        ruleId: rule.id,
        title: rule.title,
        description: `${rule.description} (entropy ${shannonEntropy(secret).toFixed(2)})`,
        severity: rule.severity,
        confidence: rule.entropy !== undefined ? "high" : "medium",
        location: { moduleId: module.id, filePath: relativePath, line: i + 1 },
        cwe: rule.cwe,
        owasp: rule.owasp,
      });
    }
  }

  return findings;
}

/** Runs keyword pre-filter, regex match, entropy and stopword checks; returns the secret or null. */
function extractSecret(line: string, rule: SecretRule): string | null {
  if (rule.keywords && rule.keywords.length > 0 && !rule.keywords.some((k) => line.includes(k))) {
    return null;
  }

  const match = line.match(rule.regex);
  if (!match) return null;

  const group = rule.secretGroup ?? 0;
  const secret = match[group];
  if (secret === undefined || secret.length === 0) return null;

  if (rule.stopwords && rule.stopwords.some((w) => secret.toLowerCase().includes(w.toLowerCase()))) {
    return null;
  }
  if (rule.entropy !== undefined && shannonEntropy(secret) < rule.entropy) {
    return null;
  }
  return secret;
}
