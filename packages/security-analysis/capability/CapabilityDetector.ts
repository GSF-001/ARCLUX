// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0

import type { BehavioralEvidence, CapabilitySignal } from "./CapabilityEvidence";

const PATTERNS: Array<{ signal: CapabilitySignal; pattern: RegExp; detail: string }> = [
  { signal: "network-io", pattern: /\b(fetch|axios|http\.request|https\.request|net\.connect|WebSocket)\b/i, detail: "Network-like request primitive or protocol reference" },
  { signal: "dynamic-target", pattern: /\b(dynamicTarget|targetUrl|endpointUrl|baseUrl)\b/i, detail: "Target is represented as runtime data" },
  { signal: "input-mutation", pattern: /\b(fuzz(ing)?|inputMutation|mutatedInput|probeInput)\b/i, detail: "Input mutation or variant generation" },
  { signal: "response-branching", pattern: /\b(response\.(status|ok|body)|branchOnResponse|responseDriven)\b/i, detail: "Control flow can depend on a response" },
  { signal: "execution-capability", pattern: /\b(child_process|execFile|spawn|eval|new Function)\b/i, detail: "Execution-capable API or command model" },
  { signal: "credential-capability", pattern: /\b(password|apiKey|accessToken|credentialStore|secretKey)\b/i, detail: "Credential or authentication material model" },
];

export function detectCapabilityEvidence(files: Array<{ file: string; source: string }>): BehavioralEvidence[] {
  const evidence: BehavioralEvidence[] = [];
  for (const file of files) {
    const lines = file.source.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const candidate of PATTERNS) {
        if (candidate.pattern.test(line)) {
          evidence.push({ signal: candidate.signal, file: file.file, line: index + 1, detail: candidate.detail, confidence: 0.8 });
        }
      }
    });
  }
  return evidence;
}
