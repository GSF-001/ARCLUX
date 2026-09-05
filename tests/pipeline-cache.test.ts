// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the local-path fingerprint cache (analyzeLocalPath): content
// fingerprint decides hit/miss (never timestamps), a hit returns the SAME
// repository object with re-anchored stamp+clock, and any edit misses.
// The honesty invariant: cacheHit + fresh stamp travel together.

import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeRepository } from "../packages/engine/pipeline";
import { evaluateFreshness, getHeadState } from "../packages/git/headFreshness";

const dirs: string[] = [];
function track(dir: string): string {
  dirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function git(dir: string, ...args: string[]): void {
  execFileSync("git", ["-c", "user.email=t@t.co", "-c", "user.name=t", ...args], { cwd: dir });
}

function makeRepo(): string {
  const dir = track(mkdtempSync(join(tmpdir(), "arclux-cache-")));
  writeFileSync(join(dir, "a.ts"), "export function a() { return 1; }\n");
  writeFileSync(join(dir, "b.ts"), 'import { a } from "./a";\nexport function b() { return a(); }\n');
  git(dir, "init", "-q");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "one");
  return dir;
}

describe("local fingerprint cache", () => {
  it("miss then hit: second identical analysis returns the cached repository", async () => {
    const dir = makeRepo();
    const first = await analyzeRepository({ localPath: dir });
    expect(first.cacheHit).toBe(false);
    const second = await analyzeRepository({ localPath: dir });
    expect(second.cacheHit).toBe(true);
    expect(second.repository).toBe(first.repository);
    expect(second.moduleCount).toBe(first.moduleCount);
  }, 120000);

  it("any content edit misses and rebuilds", async () => {
    const dir = makeRepo();
    const first = await analyzeRepository({ localPath: dir });
    writeFileSync(join(dir, "a.ts"), "export function a() { return 2; }\n");
    const second = await analyzeRepository({ localPath: dir });
    expect(second.cacheHit).toBe(false);
    expect(second.repository).not.toBe(first.repository);
  }, 120000);

  it("commit-without-change hits AND re-anchors the stamp (honest hit)", async () => {
    const dir = makeRepo();
    const first = await analyzeRepository({ localPath: dir });
    const oldCommit = first.meta.buildHead?.commit;
    // Empty commit: same content, new HEAD — the sharp edge.
    git(dir, "commit", "-qm", "empty", "--allow-empty");
    const second = await analyzeRepository({ localPath: dir });
    expect(second.cacheHit).toBe(true);
    expect(second.repository).toBe(first.repository);
    // Re-anchored, not pointing at the past:
    expect(second.meta.buildHead?.commit).not.toBe(oldCommit);
    expect(second.meta.buildHead?.commit).toBe((await getHeadState(dir)).commit);
    expect(evaluateFreshness(second.meta.buildHead ?? null, await getHeadState(dir))).toBe("FRESH");
  }, 120000);
});
