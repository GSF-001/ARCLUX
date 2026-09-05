// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for head freshness (packages/git/headFreshness.ts) — port of
// ManSio/mscodebase-intelligence's freshness contract
// (tests/test_symbol_freshness.py, issues #21/#22 fix line). Uses real
// throwaway git repos: FRESH only when build head == HEAD and clean;
// everything else is STALE or fail-closed INCONCLUSIVE.

import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateFreshness, getHeadState, reportFreshness } from "../packages/git/headFreshness";
import { analyzeRepository } from "../packages/engine/pipeline";

const dirs: string[] = [];
function track(dir: string): string {
  dirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function git(dir: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.email=t@t.co", "-c", "user.name=t", ...args], {
    cwd: dir,
    encoding: "utf8",
  });
}

function makeRepo(): string {
  const dir = track(mkdtempSync(join(tmpdir(), "arclux-fresh-")));
  git(dir, "init", "-q");
  writeFileSync(join(dir, "a.txt"), "one\n");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "one");
  return dir;
}

describe("getHeadState", () => {
  it("captures commit sha on a clean repo", async () => {
    const dir = makeRepo();
    const st = await getHeadState(dir);
    expect(st.isRepo).toBe(true);
    expect(st.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(st.dirty).toBe(false);
  });

  it("reports dirty on modification and on untracked files", async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "a.txt"), "two\n");
    expect((await getHeadState(dir)).dirty).toBe(true);
    git(dir, "checkout", "--", "a.txt");
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "sub", "new.txt"), "x\n");
    expect((await getHeadState(dir)).dirty).toBe(true);
  });

  it("non-git directory degrades gracefully (never throws)", async () => {
    const dir = track(mkdtempSync(join(tmpdir(), "arclux-nogit-")));
    const st = await getHeadState(dir);
    expect(st).toEqual({ isRepo: false, commit: null, dirty: false });
  });
});

describe("evaluateFreshness (ManSio 7-case contract)", () => {
  it("build head == HEAD and clean -> FRESH", async () => {
    const dir = makeRepo();
    const built = await getHeadState(dir);
    expect(evaluateFreshness(built, await getHeadState(dir))).toBe("FRESH");
  });

  it("HEAD moved after build -> STALE", async () => {
    const dir = makeRepo();
    const built = await getHeadState(dir);
    writeFileSync(join(dir, "b.txt"), "two\n");
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "two");
    expect(evaluateFreshness(built, await getHeadState(dir))).toBe("STALE");
  });

  it("dirty tree at read time (same HEAD) -> STALE", async () => {
    const dir = makeRepo();
    const built = await getHeadState(dir);
    writeFileSync(join(dir, "a.txt"), "dirty\n");
    expect(evaluateFreshness(built, await getHeadState(dir))).toBe("STALE");
  });

  it("dirty tree at build time -> STALE even if HEAD matches", async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "a.txt"), "dirty\n");
    const built = await getHeadState(dir);
    expect(built.dirty).toBe(true);
    git(dir, "checkout", "--", "a.txt");
    expect(evaluateFreshness(built, await getHeadState(dir))).toBe("STALE");
  });

  it("legacy record (null build head) -> INCONCLUSIVE, never FRESH", async () => {
    const dir = makeRepo();
    expect(evaluateFreshness(null, await getHeadState(dir))).toBe("INCONCLUSIVE");
    expect(evaluateFreshness(undefined, await getHeadState(dir))).toBe("INCONCLUSIVE");
  });

  it("non-git tree -> INCONCLUSIVE (fail-closed)", async () => {
    const dir = track(mkdtempSync(join(tmpdir(), "arclux-nogit-")));
    const st = await getHeadState(dir);
    expect(evaluateFreshness({ isRepo: true, commit: "abc", dirty: false }, st)).toBe("INCONCLUSIVE");
    expect(evaluateFreshness(null, st)).toBe("INCONCLUSIVE");
  });

  it("missing commit sha on either side -> INCONCLUSIVE", async () => {
    const dir = makeRepo();
    const built = await getHeadState(dir);
    expect(evaluateFreshness({ isRepo: true, commit: null, dirty: false }, built)).toBe("INCONCLUSIVE");
  });
});

describe("reportFreshness (human wording over the verdict)", () => {
  it("FRESH carries the short commit", async () => {
    const dir = makeRepo();
    const built = await getHeadState(dir);
    const rep = reportFreshness(built, await getHeadState(dir));
    expect(rep.verdict).toBe("FRESH");
    expect(rep.shortCommit).toMatch(/^[0-9a-f]{7}$/);
    expect(rep.detail).toContain("clean");
  });

  it("moved tree explains both commits", async () => {
    const dir = makeRepo();
    const built = await getHeadState(dir);
    writeFileSync(join(dir, "b.txt"), "two\n");
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "two");
    const rep = reportFreshness(built, await getHeadState(dir));
    expect(rep.verdict).toBe("STALE");
    expect(rep.detail).toContain("re-run analysis");
    expect(rep.detail).toContain(rep.shortCommit as string);
  });

  it("dirty tree explains working-tree tracking instead of alarming", async () => {
    const dir = makeRepo();
    const built = await getHeadState(dir);
    writeFileSync(join(dir, "a.txt"), "dirty\n");
    const rep = reportFreshness(built, await getHeadState(dir));
    expect(rep.verdict).toBe("STALE");
    expect(rep.detail).toContain("working tree");
  });

  it("legacy/non-git explains the missing anchor", async () => {
    const dir = makeRepo();
    const rep = reportFreshness(null, await getHeadState(dir));
    expect(rep.verdict).toBe("INCONCLUSIVE");
    expect(rep.shortCommit).toBeNull();
    expect(rep.detail).toContain("no git anchor");
  });
});

describe("pipeline stamp shape (regression: stamp must satisfy the evaluator)", () => {
  it("analyzeRepository stamps a buildHead that evaluates FRESH end-to-end", async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "b.ts"), "export function b() { return 1; }\n");
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "two");
    const result = await analyzeRepository({ localPath: dir });
    // The stamp must carry isRepo — a {commit,dirty}-only stamp silently
    // degrades every read to INCONCLUSIVE (caught live via CLI smoke test).
    expect(result.meta.buildHead?.isRepo).toBe(true);
    const rep = reportFreshness(result.meta.buildHead ?? null, await getHeadState(dir));
    expect(rep.verdict).toBe("FRESH");
  }, 120000);
});
