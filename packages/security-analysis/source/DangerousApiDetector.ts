// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SecurityFinding } from "../SecurityFinding";
const APIS: Array<[RegExp, string]> = [
  [/child_process\.(?:exec|execSync|spawn|spawnSync)/, "Node process execution"],
  [/subprocess\.(?:run|Popen|call)/, "Python process execution"],
  [/Runtime\.getRuntime\(\)\.exec/, "Java process execution"],
];
export function detectDangerousApis(file: string, source: string): SecurityFinding[] {
  return source.split(/\r?\n/).flatMap((line, index) => APIS.filter(([pattern]) => pattern.test(line)).map(([pattern, title]) => ({
    id: `dangerous-api:${file}:${index + 1}`,
    ruleId: "dangerous-process-api",
    title,
    description: "A process-execution API was detected; validate all arguments and authorization.",
    severity: "medium" as const,
    confidence: "medium" as const,
    location: { moduleId: file, filePath: file, line: index + 1 },
    remediation: {
      summary: "Validate process arguments and use an allowlist.",
      detail: `Matched ${pattern.source}.`,
    },
  })));
}
