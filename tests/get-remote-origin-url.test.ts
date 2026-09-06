// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for getRemoteOriginUrl (packages/git/getRemoteOriginUrl.ts) —
// resolver behind the branches MCP tool (issue #616). Uses real
// throwaway git repos: returns the origin URL, or null when the dir is
// not a git repo / has no origin remote.

import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getRemoteOriginUrl } from "../packages/git/getRemoteOriginUrl";

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

function makeRepo(withOrigin: string | null): string {
  const dir = track(mkdtempSync(join(tmpdir(), "arclux-origin-")));
  git(dir, "init", "-b", "main");
  writeFileSync(join(dir, "a.txt"), "a");
  git(dir, "add", "-A");
  git(dir, "commit", "-m", "init");
  if (withOrigin !== null) {
    git(dir, "remote", "add", "origin", withOrigin);
  }
  return dir;
}

describe("getRemoteOriginUrl", () => {
  it("returns the origin URL for a repo with origin", () => {
    const dir = makeRepo("https://github.com/example/repo.git");
    expect(getRemoteOriginUrl(dir)).toBe("https://github.com/example/repo.git");
  });

  it("returns null for a repo without origin", () => {
    const dir = makeRepo(null);
    expect(getRemoteOriginUrl(dir)).toBeNull();
  });

  it("returns null for a non-git directory", () => {
    const dir = track(mkdtempSync(join(tmpdir(), "arclux-origin-")));
    expect(getRemoteOriginUrl(dir)).toBeNull();
  });

  it("returns null for a nonexistent path", () => {
    expect(getRemoteOriginUrl(join(tmpdir(), "arclux-does-not-exist"))).toBeNull();
  });
});