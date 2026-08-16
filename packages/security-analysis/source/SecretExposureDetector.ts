// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SecurityFinding } from "../SecurityFinding";
const SECRET_PATTERNS = [
  /(?:api[_-]?key|secret|access[_-]?token|private[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
export function detectSecretExposure(file: string, source: string): SecurityFinding[] {
  return source.split(/\r?\n/).flatMap((line, index) => SECRET_PATTERNS.some((pattern) => pattern.test(line)) ? [{
    id: `secret-${file}-${index + 1}`, title: "Potential secret exposure", category: "secret-exposure" as const,
    severity: "high" as const, message: "A source line matches a credential-like pattern.", confidence: 0.72,
    remediation: "Rotate the credential, remove it from source history, and load it from a secret manager.",
    evidence: [{ file, line: index + 1, source: line.trim(), reason: "Credential-like pattern matched." }],
  }] : []);
}
