// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unsafe-pattern detection modeled on Semgrep's rule model (verified
// against Semgrep rule-syntax docs, 2026-08-16: id/message/severity/
// metadata cwe+owasp; negative patterns as allowlists here). This is a
// line-pattern scanner over the SourceProvider content channel — the
// Semgrep analogue of `pattern-regex` rules. Structural analyzers
// (trust boundary, data flow) live in architecture/ and source/
// SensitiveDataFlowDetector.ts.

import type { Repository } from "../../repository/Repository";
import type { SecuritySeverity } from "../SecuritySeverity";
import type { SecurityFinding } from "../SecurityFinding";
import type { SourceProvider } from "../SourceProvider";

export interface UnsafePatternRule {
  id: string;
  /** Matcher over one line of content. */
  regex: RegExp;
  /** Keyword pre-filter — the line must contain at least one of these. */
  keywords?: string[];
  /** If the matched line contains any of these, the match is dropped. */
  notInside?: string[];
  severity: SecuritySeverity;
  title: string;
  description: string;
  cwe?: string[];
  owasp?: string[];
}

export interface UnsafePatternOptions {
  /** Custom rules — replaces the default set when provided. */
  rules?: UnsafePatternRule[];
  /** Regexes against the relative path; matching modules are skipped. */
  allowlistPaths?: RegExp[];
}

// The patterns below ARE the detection definitions: they describe attacks
// (eval/Function/exec calls, XSS sinks) so the scanner can find them in
// OTHER repos. They are matched, never executed, by this detector —
// ThreatCrush flags the literal strings as js-dynamic-code-execution /
// js-unescaped-html-sink, which is a false positive by the repo guard
// "check the execution path, not the presence of the string"
// (AGENT_DIARY 2026-08-13 ThreatCrush entry). Kept as readable regexes on
// purpose — the pattern is the product's documentation.
export const DEFAULT_UNSAFE_PATTERN_RULES: UnsafePatternRule[] = [
  {
    id: "unsafe-eval",
    regex: /\beval\s*\(/,
    keywords: ["eval("],
    notInside: ["//", "/*"],
    severity: "high",
    title: "Dynamic code execution via eval()",
    description: "eval() executes arbitrary code from a string — a common injection sink.",
    cwe: ["CWE-95"],
    owasp: ["A05:2025"],
  },
  {
    id: "dynamic-function",
    regex: /(?:new\s+Function|Function)\s*\(/,
    keywords: ["Function("],
    notInside: ["//", "*"],
    severity: "medium",
    title: "Dynamic function construction",
    description: "new Function() compiles a string as code at runtime.",
    cwe: ["CWE-95"],
    owasp: ["A05:2025"],
  },
  {
    id: "shell-exec",
    // execSync/spawn всегда; «exec(» — только НЕ как метод: `(?<![.\w])` исключает
    // RegExp.prototype.exec (regex.exec(...)) и obj.exec(...) — они не shell-вызовы.
    regex: /(?:execSync|spawn|spawnSync)\s*\(|(?<![.\w])exec\s*\(/,
    keywords: ["exec(", "execSync(", "spawn(", "spawnSync("],
    notInside: ["//", "*"],
    severity: "high",
    title: "Shell command execution",
    description: "Command execution APIs — verify the command is not built from untrusted input.",
    cwe: ["CWE-78"],
    owasp: ["A05:2025"],
  },
  {
    id: "innerhtml-assignment",
    regex: /\.innerHTML\s*=/,
    keywords: [".innerHTML"],
    severity: "high",
    title: "innerHTML assignment (XSS sink)",
    description: "Assigning untrusted content to innerHTML can lead to XSS.",
    cwe: ["CWE-79"],
    owasp: ["A05:2025"],
  },
  {
    id: "dangerously-set-innerhtml",
    regex: /dangerouslySetInnerHTML/,
    keywords: ["dangerouslySetInnerHTML"],
    severity: "high",
    title: "React dangerouslySetInnerHTML (XSS sink)",
    description: "dangerouslySetInnerHTML bypasses React's escaping — ensure content is sanitized.",
    cwe: ["CWE-79"],
    owasp: ["A05:2025"],
  },
  {
    id: "weak-crypto-md5",
    regex: /md5\s*\(/i,
    keywords: ["md5("],
    severity: "medium",
    title: "MD5 usage (weak hash)",
    description: "MD5 is cryptographically broken; use SHA-256+ for non-legacy purposes.",
    cwe: ["CWE-327"],
    owasp: ["A04:2025"],
  },
  {
    id: "weak-crypto-sha1",
    regex: /\bsha1\s*\(/i,
    keywords: ["sha1("],
    severity: "medium",
    title: "SHA-1 usage (weak hash)",
    description: "SHA-1 collisions are practical; use SHA-256+ for non-legacy purposes.",
    cwe: ["CWE-327"],
    owasp: ["A04:2025"],
  },
];

export function detectUnsafePatterns(
  repository: Repository,
  sources: SourceProvider,
  options: UnsafePatternOptions = {}
): SecurityFinding[] {
  const rules = options.rules ?? DEFAULT_UNSAFE_PATTERN_RULES;
  const findings: SecurityFinding[] = [];

  for (const module of repository.getAllModules()) {
    const relativePath = module.file.relativePath;
    if (options.allowlistPaths?.some((re) => re.test(relativePath))) continue;

    const content = sources.read(relativePath);
    if (content === null) continue;

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const rule of rules) {
        if (rule.keywords && rule.keywords.length > 0 && !rule.keywords.some((k) => line.includes(k))) continue;
        if (rule.notInside && rule.notInside.some((n) => line.includes(n))) continue;
        if (!rule.regex.test(line)) continue;

        findings.push({
          id: `${rule.id}:${relativePath}:${i + 1}`,
          ruleId: rule.id,
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          confidence: "medium",
          location: { moduleId: module.id, filePath: relativePath, line: i + 1 },
          cwe: rule.cwe,
          owasp: rule.owasp,
        });
      }
    }
  }

  return findings.sort(
    (a, b) =>
      a.location.filePath.localeCompare(b.location.filePath) ||
      (a.location.line ?? 0) - (b.location.line ?? 0) ||
      a.ruleId.localeCompare(b.ruleId)
  );
}
