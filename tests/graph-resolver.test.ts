// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the two-pass call resolver (packages/graph/resolveCalls.ts) —
// TypeScript port of ManSio/mscodebase-intelligence PR #20 behavior
// (tests/test_graph_resolver.py). Ladder: verified import (1.0) ->
// unique global (0.85) -> recognized external -> explicit unresolved.
// Core invariant: every RawCall lands in resolved OR unresolved —
// nothing drops silently.

import { describe, it, expect } from "vitest";
import {
  isExternalOrStdlib,
  resolveModuleCalls,
  type ResolverInput,
} from "../packages/graph/resolveCalls";

/** exportMap builder: [["mod.ts", ["a", "b"]]] -> Map<mod, Set<names>> */
function exp(entries: Array<[string, string[]]>): Map<string, Set<string>> {
  return new Map(entries.map(([k, v]): [string, Set<string>] => [k, new Set(v)]));
}

/** globalNameMap builder: [["name", ["a.ts", "b.ts"]]] */
function glo(entries: Array<[string, string[]]>): Map<string, string[]> {
  return new Map(entries);
}

function input(over: Partial<ResolverInput> = {}): ResolverInput {
  return {
    rawCalls: [],
    internalImports: [],
    externalImports: [],
    exportMap: new Map(),
    hasDefaultExport: new Map(),
    globalNameMap: new Map(),
    knownDependencies: new Set(),
    ...over,
  };
}

describe("two-pass resolver ladder", () => {
  it("3.1 import: named import verified against target exports -> 1.0/import", () => {
    const out = resolveModuleCalls(
      input({
        rawCalls: [{ calleeName: "targetFunc", line: 42 }],
        internalImports: [{ moduleId: "target.ts", namedImports: ["targetFunc"] }],
        exportMap: exp([["target.ts", ["targetFunc"]]]),
        globalNameMap: glo([["targetFunc", ["target.ts"]]]),
      }),
    );
    expect(out.resolved).toEqual([
      { moduleId: "target.ts", calleeName: "targetFunc", line: 42, confidence: 1.0, resolver: "import" },
    ]);
    expect(out.unresolved).toEqual([]);
  });

  it("3.2 unique global: no import, single repo exporter -> 0.85/unique-global", () => {
    const out = resolveModuleCalls(
      input({
        rawCalls: [{ calleeName: "UniqueService", line: 7 }],
        exportMap: exp([["unique.ts", ["UniqueService"]]]),
        globalNameMap: glo([["UniqueService", ["unique.ts"]]]),
      }),
    );
    expect(out.resolved).toEqual([
      { moduleId: "unique.ts", calleeName: "UniqueService", line: 7, confidence: 0.85, resolver: "unique-global" },
    ]);
    expect(out.unresolved).toEqual([]);
  });

  it("G1: ambiguous import (2 verified modules) -> explicit ambiguous, never last-write-wins", () => {
    const out = resolveModuleCalls(
      input({
        rawCalls: [{ calleeName: "helper", line: 3 }],
        internalImports: [
          { moduleId: "a.ts", namedImports: ["helper"] },
          { moduleId: "b.ts", namedImports: ["helper"] },
        ],
        exportMap: exp([
          ["a.ts", ["helper"]],
          ["b.ts", ["helper"]],
        ]),
        globalNameMap: glo([["helper", ["a.ts", "b.ts"]]]),
      }),
    );
    expect(out.resolved).toEqual([]);
    expect(out.unresolved).toEqual([
      { calleeName: "helper", line: 3, reason: "ambiguous", candidates: ["a.ts", "b.ts"] },
    ]);
  });

  it("ambiguous global without import falls through to unknown (mirrors ManSio: only len==1 resolves)", () => {
    const out = resolveModuleCalls(
      input({
        rawCalls: [{ calleeName: "helper", line: 3 }],
        exportMap: exp([
          ["a.ts", ["helper"]],
          ["b.ts", ["helper"]],
        ]),
        globalNameMap: glo([["helper", ["a.ts", "b.ts"]]]),
      }),
    );
    expect(out.resolved).toEqual([]);
    expect(out.unresolved).toEqual([{ calleeName: "helper", line: 3, reason: "unknown" }]);
  });

  it("3.3 external builtin: import { join } from 'path' -> unresolved external", () => {
    const out = resolveModuleCalls(
      input({
        rawCalls: [{ calleeName: "join", line: 5 }],
        externalImports: [{ packageName: "path", namedImports: ["join"] }],
        knownDependencies: new Set(),
      }),
    );
    expect(out.resolved).toEqual([]);
    expect(out.unresolved).toEqual([
      { calleeName: "join", line: 5, reason: "external", packageName: "path" },
    ]);
  });

  it("3.3 external dep: lodash in knownDependencies -> unresolved external + packageName", () => {
    const out = resolveModuleCalls(
      input({
        rawCalls: [{ calleeName: "debounce", line: 9 }],
        externalImports: [{ packageName: "lodash", namedImports: ["debounce"] }],
        knownDependencies: new Set(["lodash"]),
      }),
    );
    expect(out.unresolved).toEqual([
      { calleeName: "debounce", line: 9, reason: "external", packageName: "lodash" },
    ]);
  });

  it("3.4 fallback: local/typo with no match -> explicit unknown (never silent)", () => {
    const out = resolveModuleCalls(
      input({
        rawCalls: [{ calleeName: "localHelper", line: 11 }],
        exportMap: exp([["other.ts", ["somethingElse"]]]),
        globalNameMap: glo([["somethingElse", ["other.ts"]]]),
      }),
    );
    expect(out.resolved).toEqual([]);
    expect(out.unresolved).toEqual([{ calleeName: "localHelper", line: 11, reason: "unknown" }]);
  });

  it("G2: default import via defaultLocalName + verified default export -> 1.0/import", () => {
    const out = resolveModuleCalls(
      input({
        rawCalls: [{ calleeName: "h", line: 4 }],
        internalImports: [{ moduleId: "h.ts", namedImports: [], defaultLocalName: "h" }],
        exportMap: exp([["h.ts", []]]),
        hasDefaultExport: new Map([["h.ts", true]]),
      }),
    );
    expect(out.resolved).toEqual([
      { moduleId: "h.ts", calleeName: "h", line: 4, confidence: 1.0, resolver: "import" },
    ]);
    expect(out.unresolved).toEqual([]);
  });

  it("default import without a default export in target -> unknown (no blind resolve)", () => {
    const out = resolveModuleCalls(
      input({
        rawCalls: [{ calleeName: "h", line: 4 }],
        internalImports: [{ moduleId: "h.ts", namedImports: [], defaultLocalName: "h" }],
        exportMap: exp([["h.ts", ["other"]]]),
        hasDefaultExport: new Map([["h.ts", false]]),
        globalNameMap: glo([["other", ["h.ts"]]]),
      }),
    );
    expect(out.resolved).toEqual([]);
    expect(out.unresolved).toEqual([{ calleeName: "h", line: 4, reason: "unknown" }]);
  });

  it("G5: named import the target does not export -> falls through, never blind-resolves", () => {
    const out = resolveModuleCalls(
      input({
        rawCalls: [{ calleeName: "typoFn", line: 6 }],
        internalImports: [{ moduleId: "real.ts", namedImports: ["typoFn"] }],
        exportMap: exp([["real.ts", ["realFn"]]]),
        globalNameMap: glo([["realFn", ["real.ts"]]]),
      }),
    );
    expect(out.resolved).toEqual([]);
    expect(out.unresolved).toEqual([{ calleeName: "typoFn", line: 6, reason: "unknown" }]);
  });

  it("no-silent-drop invariant: resolved + unresolved covers every raw call", () => {
    const rawCalls = [
      { calleeName: "a", line: 1 },
      { calleeName: "b", line: 2 },
      { calleeName: "c", line: 3 },
      { calleeName: "d", line: 4 },
    ];
    const out = resolveModuleCalls(
      input({
        rawCalls,
        internalImports: [{ moduleId: "a.ts", namedImports: ["a"] }],
        externalImports: [{ packageName: "fs", namedImports: ["c"] }],
        exportMap: exp([["a.ts", ["a"]]]),
        globalNameMap: glo([["a", ["a.ts"]]]),
        knownDependencies: new Set(),
      }),
    );
    expect(out.resolved.length + out.unresolved.length).toBe(rawCalls.length);
    expect(out.resolved[0].calleeName).toBe("a");
    expect(out.unresolved.map((u) => u.calleeName).sort()).toEqual(["b", "c", "d"]);
  });
});

describe("isExternalOrStdlib (TS answer to sys.stdlib_module_names)", () => {
  const deps = new Set(["lodash", "@scope/pkg"]);
  it("node builtins recognized, bare and node:-prefixed", () => {
    expect(isExternalOrStdlib("fs", deps)).toBe(true);
    expect(isExternalOrStdlib("node:path", deps)).toBe(true);
    expect(isExternalOrStdlib("os", deps)).toBe(true);
  });
  it("known deps recognized, scoped packages compare on @scope/name", () => {
    expect(isExternalOrStdlib("lodash", deps)).toBe(true);
    expect(isExternalOrStdlib("lodash/debounce", deps)).toBe(true);
    expect(isExternalOrStdlib("@scope/pkg", deps)).toBe(true);
    expect(isExternalOrStdlib("@scope/pkg/sub", deps)).toBe(true);
  });
  it("unknown bare specifiers rejected; empty rejected", () => {
    expect(isExternalOrStdlib("my-hypothetical-module", deps)).toBe(false);
    expect(isExternalOrStdlib("", deps)).toBe(false);
  });
});
