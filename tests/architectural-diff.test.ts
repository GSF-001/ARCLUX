// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Integration tests for packages/diff/architecturalDiff.ts (issue #451) —
// the core of the `arclux diff` command. Runs against a REAL git repo in a
// temp dir (same pattern as tests/git-history.test.ts), then indexes the
// working tree via the REAL pipeline (analyzeRepository). Pins the
// documented MVP contract: changed files between two refs + transitive
// consumers computed against the CURRENT tree.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeArchitecturalDiff } from "../packages/diff/architecturalDiff";
import { analyzeRepository, type AnalyzeRepositoryResult } from "../packages/engine/pipeline";

function run(dir: string, cmd: string): string {
  return execSync(cmd, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

describe("computeArchitecturalDiff", () => {
  let dir: string;
  let created = false;
  let result: AnalyzeRepositoryResult;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "arclux-diff-test-"));
    run(dir, "git init -b main");
    run(dir, 'git config user.email "tester@arclux.test"');
    run(dir, 'git config user.name "Test User"');

    // v1: entry imports service imports data.
    writeFileSync(join(dir, "entry.ts"), 'import { getService } from "./service";\nexport const entry = getService();\n');
    writeFileSync(join(dir, "service.ts"), 'import { data } from "./data";\nexport function getService() { return data; }\n');
    writeFileSync(join(dir, "data.ts"), 'export const data = 1;\n');
    run(dir, 'git add . && git commit -m "v1"');

    // v2: modify service.ts (its consumers are now at risk), add an unused file.
    writeFileSync(join(dir, "service.ts"), 'import { data } from "./data";\nexport function getService() { return data + 1; }\n');
    writeFileSync(join(dir, "unused.ts"), "export const unused = true;\n");
    run(dir, 'git add . && git commit -m "v2"');

    created = true;
  }, 60_000);

  afterAll(() => {
    if (created) rmSync(dir, { recursive: true, force: true });
  });

  beforeAll(async () => {
    // Index the CURRENT working tree (v2) through the real pipeline.
    result = await analyzeRepository({ localPath: dir });
  }, 60_000);

  it("reports the files changed between the two refs with their statuses", () => {
    const diff = computeArchitecturalDiff(result.repository, dir, "HEAD~1", "HEAD");
    const byPath = Object.fromEntries(diff.changedFiles.map((f) => [f.path, f.status]));
    expect(byPath["service.ts"]).toBe("modified");
    expect(byPath["unused.ts"]).toBe("added");
    // data.ts and entry.ts untouched in v2
    expect(byPath["data.ts"]).toBeUndefined();
    expect(byPath["entry.ts"]).toBeUndefined();
  });

  it("reports transitive consumers of the modified file as affected", () => {
    const diff = computeArchitecturalDiff(result.repository, dir, "HEAD~1", "HEAD");
    // service.ts changed -> its direct consumer entry.ts is affected.
    expect(diff.affectedFiles).toContain("entry.ts");
    // The added unused.ts has no importers -> not affected.
    expect(diff.affectedFiles).not.toContain("unused.ts");
  });

  it("indexes the working tree modules for the diff to trace against", () => {
    const ids = result.repository.getAllModules().map((m) => m.id).sort();
    expect(ids).toEqual(["data.ts", "entry.ts", "service.ts", "unused.ts"]);
  });
});
