// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the rule engine and the implemented framework rules:
// RuleEngine.runRules framework filtering, nextjs/requirePage, and the
// two react rules added in this round (requireComponentExport,
// requireHookRules). Fixtures are hand-built Repositories, same style as
// tests/detector.test.ts.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { runRules, type Rule, type RuleViolation } from "../packages/rules/RuleEngine";
import { requirePage } from "../packages/rules/nextjs/requirePage";
import { requireComponentExport } from "../packages/rules/react/requireComponentExport";
import { requireHookRules } from "../packages/rules/react/requireHookRules";
import type { ModuleInfo, RepositoryMeta, FileInfo, RawExport } from "../packages/shared/types";

function makeFile(relativePath: string): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language: "typescript",
    extension: relativePath.endsWith(".tsx") ? ".tsx" : ".ts",
    sizeBytes: 100,
    hash: "fake-hash",
  };
}

function named(name: string, line = 1): RawExport {
  return { name, kind: "named", line };
}

function defaultExport(name: string, line = 1): RawExport {
  return { name, kind: "default", line };
}

function makeModule(relativePath: string, exports: RawExport[] = []): ModuleInfo {
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports,
    resolvedReExports: {},
    importedBy: [],
    imports: [],
    resolvedImports: [],
    implicitDependencies: [],
  };
}

function makeRepository(modules: ModuleInfo[]): Repository {
  const meta: RepositoryMeta = {
    id: "test-repo",
    org: "test-org",
    name: "test-repo",
    defaultBranch: "main",
    rootPath: "/virtual/repo",
    detectedFrameworks: [],
    packageManager: "npm",
    analyzedAt: new Date().toISOString(),
  };
  const repository = new Repository(meta);
  for (const mod of modules) {
    repository.addModule(mod);
  }
  return repository;
}

describe("RuleEngine.runRules", () => {
  const fakeRule: Rule = {
    id: "fake/rule",
    description: "fires for every module",
    appliesToFramework: "react",
    check: () => [{ ruleId: "fake/rule", message: "boom", filePath: "x.ts", severity: "warning" }],
  };

  it("runs a rule only when its framework was detected", () => {
    const repo = makeRepository([makeModule("a.ts", [named("a")])]);
    expect(runRules(repo, [fakeRule], [])).toHaveLength(0);
    expect(runRules(repo, [fakeRule], ["react"])).toHaveLength(1);
  });

  it("returns violations in rule order", () => {
    const secondRule: Rule = {
      id: "fake/rule-2",
      description: "also fires",
      appliesToFramework: "react",
      check: () => [{ ruleId: "fake/rule-2", message: "also", filePath: "b.ts", severity: "error" }],
    };
    const repo = makeRepository([makeModule("a.ts", [named("a")])]);
    const violations = runRules(repo, [fakeRule, secondRule], ["react"]);
    expect(violations.map((v) => v.ruleId)).toEqual(["fake/rule", "fake/rule-2"]);
  });
});

describe("nextjs/requirePage", () => {
  it("flags a layout with no page.tsx in its subtree", () => {
    const repo = makeRepository([
      makeModule("app/dashboard/layout.tsx", [named("DashboardLayout")]),
      makeModule("app/other/page.tsx", [defaultExport("Other")]),
    ]);
    const violations = runRules(repo, [requirePage], ["nextjs"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe("app/dashboard/layout.tsx");
    expect(violations[0].severity).toBe("warning");
  });

  it("passes a layout whose subtree contains a page", () => {
    const repo = makeRepository([
      makeModule("app/dashboard/layout.tsx", [named("DashboardLayout")]),
      makeModule("app/dashboard/page.tsx", [defaultExport("Dashboard")]),
    ]);
    expect(runRules(repo, [requirePage], ["nextjs"])).toHaveLength(0);
  });
});

describe("react/requireComponentExport", () => {
  it("flags a PascalCase component file that exports nothing", () => {
    const repo = makeRepository([makeModule("src/components/Button.tsx", [])]);
    const violations = runRules(repo, [requireComponentExport], ["react"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe("src/components/Button.tsx");
  });

  it("passes component files with a default or named export", () => {
    const repo = makeRepository([
      makeModule("src/components/Button.tsx", [defaultExport("Button")]),
      makeModule("src/components/Card.tsx", [named("Card")]),
    ]);
    expect(runRules(repo, [requireComponentExport], ["react"])).toHaveLength(0);
  });

  it("ignores non-PascalCase files and Next.js convention filenames", () => {
    const repo = makeRepository([
      makeModule("src/components/button.tsx", []), // lowercase — not a component by convention
      makeModule("app/page.tsx", []), // routing convention, not a component
    ]);
    expect(runRules(repo, [requireComponentExport], ["react"])).toHaveLength(0);
  });
});

describe("react/requireHookRules", () => {
  it("flags a useXxx file that does not export the hook name", () => {
    const repo = makeRepository([makeModule("src/hooks/useCounter.ts", [named("helper")])]);
    const violations = runRules(repo, [requireHookRules], ["react"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe("src/hooks/useCounter.ts");
  });

  it("passes a hook file exporting the matching useXxx name", () => {
    const repo = makeRepository([makeModule("src/hooks/useCounter.ts", [named("useCounter")])]);
    expect(runRules(repo, [requireHookRules], ["react"])).toHaveLength(0);
  });

  it("ignores non-hook files", () => {
    const repo = makeRepository([makeModule("src/hooks/counter.ts", [named("useCounter")])]);
    expect(runRules(repo, [requireHookRules], ["react"])).toHaveLength(0);
  });
});
