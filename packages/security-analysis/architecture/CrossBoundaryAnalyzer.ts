// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Call-level trust boundary analysis: a module in an UNTRUSTED zone makes
// a resolved call into a TRUSTED module's exported function. Stronger
// signal than TrustBoundaryAnalyzer (which is import-level) and pinned to
// the exact call site via ResolvedCall.line.
//
// Honest scope note: ARCLUX's call graph only resolves bare-identifier
// calls against named imports (see RawCall/ResolvedCall in shared/types.ts).
// `obj.method()` and `this.method()` calls are NEVER resolved, so a
// controller calling this.service.createUser() produces no edge — the
// detector reports what the core model actually sees, nothing more.

import type { Repository } from "../../repository/Repository";
import type { SecurityFinding, SourceProvider } from "../types";
import {
  classifyTrustZone,
  DEFAULT_TRUST_ZONES,
  type TrustBoundaryOptions,
} from "./TrustBoundaryAnalyzer";

export function detectCrossBoundaryCalls(
  repository: Repository,
  _sources: SourceProvider,
  options: TrustBoundaryOptions = {}
): SecurityFinding[] {
  const zones = options.zones ?? DEFAULT_TRUST_ZONES;
  const findings: SecurityFinding[] = [];

  for (const module of repository.getAllModules()) {
    const sourceZone = classifyTrustZone(module.file.relativePath, zones);
    if (sourceZone !== "untrusted") continue;

    for (const call of module.calls) {
      const target = repository.getModule(call.moduleId);
      if (!target) continue;
      const targetZone = classifyTrustZone(target.file.relativePath, zones);
      if (targetZone !== "trusted") continue;

      findings.push({
        id: `cross-boundary-call:${module.id}:${call.calleeName}:${call.line}`,
        ruleId: "cross-boundary-call",
        title: `Untrusted code calls trusted function "${call.calleeName}"`,
        description: `"${module.file.relativePath}" calls "${call.calleeName}" exported by trusted module "${target.file.relativePath}" (line ${call.line}).`,
        severity: "high",
        confidence: "medium",
        location: { moduleId: module.id, filePath: module.file.relativePath, line: call.line },
        cwe: ["CWE-501"], // Trust boundary violation
        owasp: ["A01:2025"],
      });
    }
  }

  return findings.sort((a, b) => a.location.filePath.localeCompare(b.location.filePath) || (a.location.line ?? 0) - (b.location.line ?? 0));
}
