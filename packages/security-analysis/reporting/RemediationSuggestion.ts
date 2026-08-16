// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Template-based remediation suggestions keyed by ruleId (the Semgrep
// "fix"/message idea, applied to our own rule ids — never auto-applied,
// always advisory). Unknown rule ids yield null so callers can fall back
// to their own text.

import type { RemediationSuggestion, SecurityFinding } from "../SecurityFinding";

export type { RemediationSuggestion } from "../SecurityFinding";

const TEMPLATES: Record<string, Omit<RemediationSuggestion, "summary"> & { summary: string }> = {
  "aws-access-key": {
    summary: "Move the AWS access key to an environment variable or a secrets manager, then rotate the leaked credential.",
    detail: "Hardcoded credentials in source are extractable from git history even after deletion.",
  },
  "api-key-prefixed": {
    summary: "Move the API key to an environment variable or a secrets manager, then rotate the leaked key.",
  },
  "github-personal-access-token": {
    summary: "Revoke the token immediately, then use a short-lived token or a secret store.",
    detail: "ghp_ tokens grant repo/org access until revoked.",
  },
  "private-key-block": {
    summary: "Remove the private key from the repository and store it in a secrets manager with restricted access.",
    detail: "Private keys in source allow impersonation of the service identity.",
  },
  "generic-password-assignment": {
    summary: "Move the credential to an environment variable or a secrets manager; rotate it if it was ever committed.",
  },
  "unsafe-eval": {
    summary: "Replace eval() with a safe alternative (JSON.parse for data, a dedicated parser for expressions).",
    detail: "eval() executes arbitrary code from a string and defeats static analysis.",
  },
  "dynamic-function": {
    summary: "Avoid constructing functions from strings; use explicit functions instead.",
  },
  "shell-exec": {
    summary: "Prefer child_process.execFile/spawn with a fixed command and an argument array over shell interpolation.",
    detail: "Shell command strings built from input are an injection sink (CWE-78).",
  },
  "innerhtml-assignment": {
    summary: "Use textContent (or an escaping renderer) instead of assigning untrusted data to innerHTML.",
  },
  "dangerously-set-innerhtml": {
    summary: "Replace dangerouslySetInnerHTML with escaped rendering or sanitize the content first.",
  },
  "weak-crypto-md5": {
    summary: "Replace MD5 with SHA-256 or stronger; use a keyed construction (HMAC) where a key is involved.",
  },
  "weak-crypto-sha1": {
    summary: "Replace SHA-1 with SHA-256 or stronger; use a keyed construction (HMAC) where a key is involved.",
  },
  "sensitive-data-flow": {
    summary: "Verify input validation and access control on the data path between the source imports and the sink call.",
  },
  "trust-boundary-import": {
    summary: "Introduce an adapter/middleware layer so untrusted-facing code never imports trusted internals directly.",
  },
  "cross-boundary-call": {
    summary: "Route the call through a boundary layer (adapter/middleware) with validation instead of calling trusted code directly.",
  },
};

export function remediateRule(ruleId: string): RemediationSuggestion | null {
  const template = TEMPLATES[ruleId];
  if (!template) return null;
  return { summary: template.summary, detail: template.detail };
}

/** Attaches a remediation suggestion to every finding whose rule has a template. */
export function attachRemediations(findings: SecurityFinding[]): SecurityFinding[] {
  return findings.map((finding) => {
    const remediation = remediateRule(finding.ruleId);
    return remediation ? { ...finding, remediation } : finding;
  });
}
