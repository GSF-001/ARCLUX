// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * EvidenceBoundary — decides WHAT evidence analysis may retain and show.
 *
 * The hard rule that always applies is redaction: findings must never
 * leak secrets (API keys, tokens, passwords, AWS credentials, private
 * keys, connection strings). The soft rule is capping — per-check output
 * limits so one noisy detector can't flood a report.
 */

export interface EvidenceBoundaryOptions {
  /** Max findings retained per checkId. Default 100. */
  maxFindingsPerCheck?: number;
  /** Max length of a single finding message; longer messages are trimmed. */
  maxMessageLength?: number;
  /** When false, redaction is disabled. Default true. */
  redactSecrets?: boolean;
}

const SECRET_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "api key", re: /(api[_-]?key|apikey)["'\s:=]+[A-Za-z0-9_-]{12,}/gi },
  { label: "token", re: /(token|secret|passwd|password)["'\s:=]+[A-Za-z0-9_\-.]{12,}/gi },
  { label: "bearer", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi },
  { label: "github token", re: /gh[pousr]_[A-Za-z0-9]{30,}/g },
  { label: "aws key", re: /AKIA[0-9A-Z]{16}/g },
  { label: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { label: "connection string", re: /(mongodb|postgres(ql)?|mysql|redis):\/\/[^\s"']+/gi },
];

export class EvidenceBoundary {
  private readonly maxFindingsPerCheck: number;
  private readonly maxMessageLength: number;
  private readonly redactSecrets: boolean;

  constructor(options: EvidenceBoundaryOptions = {}) {
    this.maxFindingsPerCheck = options.maxFindingsPerCheck ?? 100;
    this.maxMessageLength = options.maxMessageLength ?? 500;
    this.redactSecrets = options.redactSecrets ?? true;
  }

  /** Replaces secret-shaped substrings with a placeholder. */
  redact(text: string): string {
    if (!this.redactSecrets) return text;
    let out = text;
    for (const { label, re } of SECRET_PATTERNS) {
      out = out.replace(re, `[REDACTED:${label}]`);
    }
    return out;
  }

  /** Caps findings per checkId and trims message lengths. */
  cap<T extends { checkId: string; message: string }>(findings: T[]): T[] {
    const seen = new Map<string, number>();
    const out: T[] = [];
    for (const finding of findings) {
      const count = seen.get(finding.checkId) ?? 0;
      if (count >= this.maxFindingsPerCheck) continue;
      seen.set(finding.checkId, count + 1);
      out.push({
        ...finding,
        message:
          finding.message.length > this.maxMessageLength
            ? `${finding.message.slice(0, this.maxMessageLength)}…`
            : finding.message,
      });
    }
    return out;
  }
}