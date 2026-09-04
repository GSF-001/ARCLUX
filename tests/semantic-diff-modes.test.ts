// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for semantic-diff detail modes (BUG-3): default summary must stay
// small (file lists + counts, no per-file impact trees, no SymbolInfo
// arrays); full mode keeps the legacy complete shape. Verified against a
// real throwaway git repo (two refs) so changedFiles is genuine.

import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex } from "../packages/indexer/buildIndex";
import { computeSemanticDiff } from "../packages/semantic-diff/SemanticDiff";
import { parserRegistry } from "../packages/parser/core/ParserRegistry";
import { parseJs } from "../packages/parser/javascript/parseJs";
import { parseTs } from "../packages/parser/typescript/parseTs";
import type { RepositoryMeta } from "../packages/shared/types";

parserRegistry.register(parseJs);
parserRegistry.register(parseTs);

const tempDirs: string[] = [];
function track(dir: string): string {
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function git(dir: string, ...args: string[]): void {
  execFileSync("git", ["-c", "user.email=t@t.co", "-c", "user.name=t", ...args], { cwd: dir });
}

const META: Omit<RepositoryMeta, "analyzedAt"> = {
  id: "semdiff-test",
  org: "local",
  name: "semdiff-test",
  defaultBranch: "local",
  rootPath: "",
  detectedFrameworks: [],
  packageManager: "unknown",
};

async function twoRefRepo(): Promise<{ dir: string; refA: string; refB: string }> {
  const dir = track(mkdtempSync(join(tmpdir(), "arclux-semdiff-")));
  writeFileSync(join(dir, "b.ts"), "export function helper() { return 1; }\n");
  writeFileSync(join(dir, "a.ts"), 'import { helper } from "./b";\nexport function run() { return helper(); }\n');
  writeFileSync(join(dir, "c.ts"), 'import { run } from "./a";\nexport function main() { return run(); }\n');
  git(dir, "init", "-q");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "one");
  const refA = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  writeFileSync(join(dir, "b.ts"), "export function helper() { return 2; }\nexport function extra() { return 3; }\n");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "two");
  const refB = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  return { dir, refA, refB };
}

describe("semantic_diff detail modes (BUG-3)", () => {
  it("default is summary: changedFiles + counts, no impact trees", async () => {
    const { dir, refA, refB } = await twoRefRepo();
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    const out = computeSemanticDiff({ repository, repoPath: dir, refA, refB });
    expect(out.mode).toBe("summary");
    expect(out.changedFiles).toContain("b.ts");
    expect(out.dependencyDiff.impactByModule).toEqual({});
    expect(Object.keys(out.impactCounts ?? {}).length).toBeGreaterThan(0);
    for (const counts of Object.values(out.impactCounts ?? {})) {
      expect(counts.affectedFiles).toBeGreaterThanOrEqual(0);
    }
  });

  it("summary JSON is smaller than full JSON on the same diff", async () => {
    const { dir, refA, refB } = await twoRefRepo();
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    const summary = computeSemanticDiff({ repository, repoPath: dir, refA, refB });
    const full = computeSemanticDiff({ repository, repoPath: dir, refA, refB, detail: "full" });
    expect(full.mode).toBe("full");
    expect(Object.keys(full.dependencyDiff.impactByModule).length).toBeGreaterThan(0);
    expect(JSON.stringify(summary).length).toBeLessThan(JSON.stringify(full).length);
  });

  it("full mode preserves the legacy complete shape", async () => {
    const { dir, refA, refB } = await twoRefRepo();
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    const full = computeSemanticDiff({ repository, repoPath: dir, refA, refB, detail: "full" });
    expect(full.impactCounts).toBeUndefined();
    expect(full.symbolCounts).toBeUndefined();
    expect(typeof full.rendered).toBe("string");
  });
});
