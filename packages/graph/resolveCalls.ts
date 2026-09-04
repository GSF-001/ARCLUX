// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { builtinModules } from "node:module";
import type {
  RawCall,
  ResolvedCall,
  UnresolvedCall,
} from "../shared/types";

/**
 * Two-pass call resolver — TypeScript port of ManSio/mscodebase-intelligence
 * PR #20 (`GraphSymbolResolver`, `src/core/search/graph_resolver.py`).
 *
 * Concept ports cleanly; the stdlib question is answered the TS way (see
 * isExternalOrStdlib): Node HAS the equivalent of Python's
 * `sys.stdlib_module_names` — `node:module`.builtinModules — plus
 * module resolution (internal vs `node_modules`) instead of a stdlib set.
 *
 * Ladder (first match wins, mirrors ManSio 3.1 → 3.4):
 *   3.1 import — callee bound by an explicit import of the caller AND the
 *       target verified to export it (fixes G5: old code never verified).
 *       Ambiguous bindings (2+ verified modules) are REFUSED, never
 *       last-write-wins (fixes G1) → unresolved "ambiguous" + candidates.
 *       Default-import calls resolve via defaultLocalName when the target
 *       has a default export (fixes G2).
 *   3.2 unique-global — callee exported by exactly one repo module, no
 *       import needed. Confidence 0.85. Ambiguous globals fall through
 *       (mirrors ManSio: only len==1 resolves).
 *   3.3 external — callee bound to an external import whose package is
 *       recognized (node builtin or seen bare specifier). Recorded as
 *       unresolved "external" + packageName. NO graph node is created
 *       (deviation from ManSio's DEPENDENCY nodes, documented below).
 *   3.4 fallback — explicit unresolved "unknown". Nothing is ever dropped
 *       silently (fixes G4).
 *
 * Deviation note: ManSio creates `{proj}.dependency.{name}` DEPENDENCY
 * nodes for externals. ARCLUX call graphs are file-node-only and consumed
 * by buildCallGraph.ts, MCP file_info, and the web graph — all of which
 * assume nodes are repo modules. External calls are therefore recorded
 * (evidence preserved) but not materialized as nodes. Phase 2 may add
 * "external-package" nodes (GraphNodeType already exists) after auditing
 * those consumers.
 */

/** One internal import binding of the calling module (resolvePath internal). */
export interface ImportBinding {
  moduleId: string;
  namedImports: string[];
  defaultLocalName?: string;
}

/** One external import binding (resolvePath external — bare specifier). */
export interface ExternalBinding {
  packageName: string;
  namedImports: string[];
  defaultLocalName?: string;
}

export interface ResolverInput {
  rawCalls: RawCall[];
  /** Internal imports of the caller (resolvePath type internal). */
  internalImports: ImportBinding[];
  /** External imports of the caller (resolvePath type external). */
  externalImports: ExternalBinding[];
  /** moduleId -> exported names (named + re-export names as listed). */
  exportMap: Map<string, Set<string>>;
  /** moduleId -> has a default export. */
  hasDefaultExport: Map<string, boolean>;
  /** exported name -> moduleIds exporting it (named only, whole repo). */
  globalNameMap: Map<string, string[]>;
  /**
   * Bare package names seen anywhere in the repo (self-consistent external
   * registry: a bare specifier imported anywhere counts as known — the
   * loose TS equivalent of ManSio's find_spec fallback).
   */
  knownDependencies: Set<string>;
}

export interface ResolverOutput {
  resolved: ResolvedCall[];
  unresolved: UnresolvedCall[];
}

const NODE_BUILTINS = new Set<string>(
  builtinModules.flatMap((m) => (m.startsWith("node:") ? [m, m.slice(5)] : [m, `node:${m}`])),
);

/**
 * TS answer to ManSio's is_external_or_stdlib: node builtins (the
 * interpreter-maintained set — no manual drift list) plus the repo's own
 * bare-specifier registry. Scoped packages compare on `@scope/name`.
 */
export function isExternalOrStdlib(packageName: string, knownDependencies: Set<string>): boolean {
  if (!packageName) return false;
  const top = packageName.startsWith("@")
    ? packageName.split("/").slice(0, 2).join("/")
    : packageName.split("/")[0];
  const bare = top.startsWith("node:") ? top.slice(5) : top;
  if (NODE_BUILTINS.has(top) || NODE_BUILTINS.has(bare)) return true;
  if (knownDependencies.has(top) || knownDependencies.has(bare)) return true;
  return false;
}

function exportsName(
  exportMap: Map<string, Set<string>>,
  hasDefaultExport: Map<string, boolean>,
  moduleId: string,
  calleeName: string,
  viaDefault: boolean,
): boolean {
  if (viaDefault) return hasDefaultExport.get(moduleId) === true;
  return exportMap.get(moduleId)?.has(calleeName) === true;
}

export function resolveModuleCalls(input: ResolverInput): ResolverOutput {
  const resolved: ResolvedCall[] = [];
  const unresolved: UnresolvedCall[] = [];

  for (const rawCall of input.rawCalls) {
    const callee = rawCall.calleeName;

    // 3.1 import — collect ALL verified candidates before deciding.
    const candidates: string[] = [];
    for (const binding of input.internalImports) {
      const viaDefault =
        binding.defaultLocalName !== undefined && binding.defaultLocalName === callee;
      const viaNamed = binding.namedImports.includes(callee);
      if (!viaDefault && !viaNamed) continue;
      if (exportsName(input.exportMap, input.hasDefaultExport, binding.moduleId, callee, viaDefault)) {
        if (!candidates.includes(binding.moduleId)) candidates.push(binding.moduleId);
      }
    }
    if (candidates.length === 1) {
      resolved.push({ moduleId: candidates[0], calleeName: callee, line: rawCall.line, confidence: 1.0, resolver: "import" });
      continue;
    }
    if (candidates.length > 1) {
      unresolved.push({ calleeName: callee, line: rawCall.line, reason: "ambiguous", candidates });
      continue;
    }

    // 3.2 unique-global — exactly one repo module exports this name.
    const globals = input.globalNameMap.get(callee) ?? [];
    if (globals.length === 1) {
      resolved.push({ moduleId: globals[0], calleeName: callee, line: rawCall.line, confidence: 0.85, resolver: "unique-global" });
      continue;
    }

    // 3.3 external — callee bound to an external import.
    const externalHit = input.externalImports.find(
      (b) => b.namedImports.includes(callee) || b.defaultLocalName === callee,
    );
    if (externalHit && isExternalOrStdlib(externalHit.packageName, input.knownDependencies)) {
      unresolved.push({ calleeName: callee, line: rawCall.line, reason: "external", packageName: externalHit.packageName });
      continue;
    }

    // 3.4 fallback — explicit unknown. Never silent.
    unresolved.push({ calleeName: callee, line: rawCall.line, reason: "unknown" });
  }

  return { resolved, unresolved };
}
