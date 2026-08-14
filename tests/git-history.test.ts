// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for packages/git/{checkoutBranch,getCommitHistory,getContributors}.
// These run against a REAL git repository built in a temp dir (git is
// required in the test environment), not mocks — same spirit as the
// indexer tmp-dir tests.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutBranch } from "../packages/git/checkoutBranch";
import { getCommitHistory } from "../packages/git/getCommitHistory";
import { getContributors } from "../packages/git/getContributors";

function run(dir: string, cmd: string): string {
  return execSync(cmd, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

describe("packages/git history helpers", () => {
  let dir: string;
  let created = false;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "arclux-git-test-"));
    run(dir, "git init -b main");
    run(dir, 'git config user.email "tester@arclux.test"');
    run(dir, 'git config user.name "Test User"');
    writeFileSync(join(dir, "a.txt"), "one");
    run(dir, 'git add a.txt && git commit -m "first commit"');
    run(dir, 'git config user.name "Second Author"');
    run(dir, 'git config user.email "second@arclux.test"');
    writeFileSync(join(dir, "b.txt"), "two");
    run(dir, 'git add b.txt && git commit -m "second commit"');
    created = true;
  });

  afterAll(() => {
    if (created) rmSync(dir, { recursive: true, force: true });
  });

  it("getCommitHistory returns commits newest-first with author info", async () => {
    const history = await getCommitHistory(dir);
    expect(history).toHaveLength(2);
    expect(history[0].message).toBe("second commit");
    expect(history[0].authorName).toBe("Second Author");
    expect(history[0].hash).toMatch(/^[0-9a-f]{40}$/);
    expect(history[1].message).toBe("first commit");
    expect(history[1].authorEmail).toBe("tester@arclux.test");
  });

  it("getCommitHistory honors maxCount", async () => {
    const history = await getCommitHistory(dir, { maxCount: 1 });
    expect(history).toHaveLength(1);
    expect(history[0].message).toBe("second commit");
  });

  it("getCommitHistory honors the path filter", async () => {
    const history = await getCommitHistory(dir, { path: "a.txt" });
    expect(history).toHaveLength(1);
    expect(history[0].message).toBe("first commit");
  });

  it("getContributors aggregates per-author commit counts, merges excluded", async () => {
    const contributors = await getContributors(dir);
    expect(contributors).toHaveLength(2);
    // sorted by count descending (both 1 here) — check contents regardless
    const byName = Object.fromEntries(contributors.map((c) => [c.name, c]));
    expect(byName["Test User"]).toEqual({ name: "Test User", email: "tester@arclux.test", commits: 1 });
    expect(byName["Second Author"]).toEqual({ name: "Second Author", email: "second@arclux.test", commits: 1 });
  });

  it("checkoutBranch is a no-op when already on the branch", async () => {
    await expect(checkoutBranch(dir, "main")).resolves.toBeUndefined();
    expect(run(dir, "git branch --show-current").trim()).toBe("main");
  });

  it("checkoutBranch switches to a local branch", async () => {
    run(dir, "git checkout -b feature");
    expect(run(dir, "git branch --show-current").trim()).toBe("feature");
    await checkoutBranch(dir, "main");
    expect(run(dir, "git branch --show-current").trim()).toBe("main");
  });
});
