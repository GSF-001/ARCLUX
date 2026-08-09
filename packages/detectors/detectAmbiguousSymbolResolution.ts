// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Logic contributed by ManSio (github.com/ManSio/mscodebase-intelligence).
// The categorisation + severity model is adapted from a runtime ranking fix
// for the D1 "wrong-source resolution" bug in that project: a symbol lookup
// that silently resolved to experiments/run_experiment_pagerank.py instead
// of src/symbol_index.py, producing wrong_rate = 1.0. The runtime fix
// (pick best candidate by path category at query time) translates here into
// a static detector: surface the collision to the developer upfront, before
// any tooling silently picks the wrong one.

import type { Repository } from "../repository/Repository";

// ─────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────

export type SymbolCategory =
  | "source"    // src/, lib/, core/, app/, apps/ — real production code
  | "test"      // test/, tests/, __tests__/, *.test.ts, *.spec.ts
  | "example"   // examples/, example/, demo/
  | "fixture"   // fixtures/, __fixtures__/
  | "mock"      // mocks/, __mocks__/
  | "script"    // scripts/, tools/
  | "other";    // anything else

export interface AmbiguousDefinition {
  moduleId: string;
  modulePath: string;
  line: number;
  category: SymbolCategory;
}

/**
 * Severity reflects how likely the collision is to produce a silently-wrong
 * answer in tooling that resolves symbols without category-awareness:
 *
 * high   — a real source definition has at least one shadow in a non-source
 *          location (test, example, fixture, mock, script). This is the
 *          exact D1 failure mode: tooling picks the wrong one confidently.
 *
 * medium — two or more definitions that are both in source paths. Less
 *          likely to be accidental, but worth flagging (e.g. copy-paste
 *          across packages, or a rename that left the old definition in
 *          place).
 *
 * low    — multiple definitions, none in a clear source path. Least
 *          urgent: a test helper duplicated in two fixture folders, etc.
 */
export type AmbiguousSeverity = "high" | "medium" | "low";

export interface AmbiguousSymbolFinding {
  symbolName: string;
  severity: AmbiguousSeverity;
  reason: string;
  definitions: AmbiguousDefinition[];
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

const TEST_DIR_SEGMENTS = new Set(["test", "tests", "__tests__"]);
const TEST_FILE_SUFFIXES = [
  ".test.ts",
  ".test.tsx",
  ".test.js",
  ".spec.ts",
  ".spec.tsx",
  ".spec.js",
];
const FIXTURE_DIR_SEGMENTS = new Set(["fixtures", "__fixtures__"]);
const MOCK_DIR_SEGMENTS = new Set(["mocks", "__mocks__"]);
const EXAMPLE_DIR_SEGMENTS = new Set(["examples", "example", "demo"]);
const SCRIPT_DIR_SEGMENTS = new Set(["scripts", "tools"]);
const SOURCE_DIR_SEGMENTS = new Set(["src", "lib", "core", "app", "apps"]);

/**
 * Assign a category to a module based on its relative path.
 *
 * FIXED (previously reported): the original implementation matched via
 * plain substring (`p.includes("/test/")`), which has two bugs:
 *   1. Case-sensitive — "TEST/foo.ts" never matched any category.
 *   2. No segment-boundary awareness — a directory named "src-test" doesn't
 *      contain the substring "/test/" (no matching slash before "test"),
 *      so it silently fell through category checks. Conversely, a nested
 *      substring like "app" inside an unrelated folder name could spuriously
 *      match a check like `.includes("/app/")` in other edge cases.
 *
 * Fix: lowercase the whole path once, split into path segments, and check
 * SET MEMBERSHIP of exact segment names — not substring containment. File
 * suffix checks (test/spec) are matched against the lowercased filename
 * directly, which is inherently boundary-safe (endsWith).
 *
 * Checks are ordered from most-specific to least-specific so that a path
 * like "src/__tests__/foo.test.ts" is classified as "test" (it matches the
 * test patterns first) rather than "source". This matters for severity
 * calculations: a test file that shadows a real source export is the classic
 * D1 case and should be flagged "high", not silently treated as a second
 * source definition.
 */
function categorize(relativePath: string): SymbolCategory {
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
  const segments = normalized.split("/");
  const fileName = segments[segments.length - 1] ?? "";

  if (
    segments.some((seg) => TEST_DIR_SEGMENTS.has(seg)) ||
    TEST_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix))
  ) {
    return "test";
  }

  if (segments.some((seg) => FIXTURE_DIR_SEGMENTS.has(seg))) return "fixture";
  if (segments.some((seg) => MOCK_DIR_SEGMENTS.has(seg))) return "mock";
  if (segments.some((seg) => EXAMPLE_DIR_SEGMENTS.has(seg))) return "example";
  if (segments.some((seg) => SCRIPT_DIR_SEGMENTS.has(seg))) return "script";

  // Real source — checked last so the test/fixture/mock overrides above win
  if (segments.some((seg) => SOURCE_DIR_SEGMENTS.has(seg))) return "source";

  return "other";
}

// ─────────────────────────────────────────────
// Main detector
// ─────────────────────────────────────────────

/**
 * Finds exported symbol names that appear in more than one module, i.e.
 * cases where tooling resolving "give me the definition of X" has to pick
 * one without any principled criterion — and may pick the wrong one silently.
 *
 * Scope of what this detects (and doesn't):
 * ✓  Same exported name, multiple modules — static, export-level only
 * ✗  Same name in nested JS/TS scopes within one file (that's ESLint no-shadow)
 * ✗  Same name reached through re-export chains that collapse to the same
 *    origin (resolvedReExports could disambiguate this, but re-export chains
 *    that bottom out at the same file aren't a collision — skipped)
 * ✗  Default exports: every module can have one "default", so the name
 *    "default" is inherently multi-defined. Skipped unless the caller opts in.
 *
 * Re-exports (exp.kind === "re-export") are skipped — they don't define
 * a new symbol, they forward one from elsewhere. Counting them would produce
 * false positives on barrel files (index.ts that re-exports everything).
 */
export function detectAmbiguousSymbolResolution(
  repository: Repository,
  { includeDefaultExports = false }: { includeDefaultExports?: boolean } = {}
): AmbiguousSymbolFinding[] {
  const byName = new Map<string, AmbiguousDefinition[]>();

  for (const module of repository.getAllModules()) {
    const category = categorize(module.file.relativePath);

    for (const exp of module.exports) {
      if (exp.kind === "re-export") continue;
      if (exp.kind === "default" && !includeDefaultExports) continue;

      const definition: AmbiguousDefinition = {
        moduleId: module.id,
        modulePath: module.file.relativePath,
        line: exp.line,
        category,
      };

      const existing = byName.get(exp.name) ?? [];
      existing.push(definition);
      byName.set(exp.name, existing);
    }
  }

  const findings: AmbiguousSymbolFinding[] = [];

  for (const [symbolName, definitions] of byName) {
    if (definitions.length < 2) continue;

    const sourceDefs = definitions.filter((d) => d.category === "source");
    const nonSourceDefs = definitions.filter((d) => d.category !== "source");

    if (sourceDefs.length > 0 && nonSourceDefs.length > 0) {
      const shadowCategories = [
        ...new Set(nonSourceDefs.map((d) => d.category)),
      ].join(", ");

      findings.push({
        symbolName,
        severity: "high",
        reason: `Source definition shadowed by ${nonSourceDefs.length} non-source definition(s) in: ${shadowCategories}`,
        definitions,
      });
    } else if (sourceDefs.length >= 2) {
      findings.push({
        symbolName,
        severity: "medium",
        reason: `${sourceDefs.length} source-path definitions (possible duplicate or unfinished rename)`,
        definitions: sourceDefs,
      });
    } else if (definitions.length >= 2) {
      findings.push({
        symbolName,
        severity: "low",
        reason: `${definitions.length} non-source definitions with the same name`,
        definitions,
      });
    }
  }

  const order: Record<AmbiguousSeverity, number> = { high: 0, medium: 1, low: 2 };

  return findings.sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      a.symbolName.localeCompare(b.symbolName)
  );
}
