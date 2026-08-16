// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// CodeQL-inspired data-flow detector, scoped honestly to what ARCLUX's
// core model actually exposes. CodeQL distinguishes local vs global flow
// and taint tracking (verified 2026-08-16, about-data-flow-analysis).
// ARCLUX's ModuleInfo carries ResolvedCall { moduleId, calleeName, line }
// — deliberately NO argument info (see RawCall in shared/types.ts:
// "the call graph only needs who is called, not with what"). Inter-module
// value/taint flow is therefore IMPOSSIBLE on current core data, so this
// detector works at MODULE granularity:
//
//   a module that (a) imports data-source packages (fs, child_process,
//   http, database drivers...) AND (b) calls sink functions (exec, eval,
//   query, writeFile...) is a candidate for sensitive-data flow.
//
// This is a heuristic triage with "low/medium" confidence by design —
// precise taint paths are out of scope until the core call model carries
// arguments (documented limitation, mirroring how existing detectors
// document theirs).

import type { Repository } from "../../repository/Repository";
import type { ModuleInfo, ResolvedImport } from "../../shared/types";
import type { SecuritySeverity } from "../SecuritySeverity";
import type { SecurityFinding } from "../SecurityFinding";
import type { SourceProvider } from "../SourceProvider";

export interface DataFlowRule {
  /** Import specifier fragments that mark a module as a data SOURCE. */
  sourceImports: string[];
  /** Callee names that are SINKS (dangerous consumption of data). */
  sinkCallees: string[];
  severity: SecuritySeverity;
  title: string;
  description: string;
  cwe?: string[];
  owasp?: string[];
}

export interface SensitiveDataFlowOptions {
  rules?: DataFlowRule[];
}

export const DEFAULT_DATA_FLOW_RULES: DataFlowRule[] = [
  {
    sourceImports: ["fs", "child_process", "crypto", "http", "https", "net", "sqlite3", "pg", "mysql2", "mongodb", "dgram"],
    sinkCallees: ["eval", "exec", "execSync", "spawn", "spawnSync", "query", "execute", "writeFile", "writeFileSync", "appendFile", "createServer"],
    severity: "medium",
    title: "Sensitive data near dangerous API",
    description:
      "This module imports a data-source package (fs/http/DB driver) AND calls a sink API (exec/query/writeFile). Verify that sensitive data cannot reach the sink.",
    cwe: ["CWE-200"],
    owasp: ["A02:2025"],
  },
];

export function detectSensitiveDataFlow(
  repository: Repository,
  _sources: SourceProvider,
  options: SensitiveDataFlowOptions = {}
): SecurityFinding[] {
  const rules = options.rules ?? DEFAULT_DATA_FLOW_RULES;
  const findings: SecurityFinding[] = [];

  for (const module of repository.getAllModules()) {
    const hits = rules.map((rule) => classifyModule(module, rule)).filter((h) => h !== null);

    for (const hit of hits) {
      findings.push({
        id: `${hit.ruleId}:${module.id}`,
        ruleId: hit.ruleId,
        title: hit.title,
        description: `${hit.description} Sources: ${hit.sources.join(", ")}; sinks: ${hit.sinks.join(", ")}.`,
        severity: hit.severity,
        confidence: "low",
        location: { moduleId: module.id, filePath: module.file.relativePath },
        cwe: hit.cwe,
        owasp: hit.owasp,
      });
    }
  }

  return findings.sort((a, b) => a.location.filePath.localeCompare(b.location.filePath));
}

interface ModuleClassHit {
  ruleId: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  sources: string[];
  sinks: string[];
  cwe?: string[];
  owasp?: string[];
}

function classifyModule(module: ModuleInfo, rule: DataFlowRule): ModuleClassHit | null {
  const importedModules = module.resolvedImports.map((imp: ResolvedImport) => imp.moduleId);

  const sources = importedModules.filter((id) => rule.sourceImports.some((s) => id.includes(s)));
  if (sources.length === 0) return null;

  const sinks = [...new Set(module.calls.filter((c) => rule.sinkCallees.includes(c.calleeName)).map((c) => c.calleeName))];
  if (sinks.length === 0) return null;

  return {
    ruleId: "sensitive-data-flow",
    title: rule.title,
    description: rule.description,
    severity: rule.severity,
    sources,
    sinks,
    cwe: rule.cwe,
    owasp: rule.owasp,
  };
}
