// Copyright 2026 ARCLUX
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { detectPackageManager } from "../packages/engine/detectRepositoryMeta";

function repoWith(files: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), "arclux-pm-"));
  for (const f of files) {
    const p = path.join(dir, f);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, "");
  }
  return dir;
}

describe("detectPackageManager", () => {
  it("detects JS/TS lockfiles", () => {
    expect(detectPackageManager(repoWith(["pnpm-lock.yaml"]))).toBe("pnpm");
    expect(detectPackageManager(repoWith(["yarn.lock"]))).toBe("yarn");
    expect(detectPackageManager(repoWith(["package-lock.json"]))).toBe("npm");
  });

  it("detects Python lockfiles", () => {
    expect(detectPackageManager(repoWith(["poetry.lock"]))).toBe("poetry");
    expect(detectPackageManager(repoWith(["uv.lock"]))).toBe("uv");
    expect(detectPackageManager(repoWith(["Pipfile.lock"]))).toBe("pipenv");
    expect(detectPackageManager(repoWith(["pdm.lock"]))).toBe("pdm");
  });

  it("falls back to pip for Python manifests without a lockfile", () => {
    expect(detectPackageManager(repoWith(["requirements.txt"]))).toBe("pip");
    expect(detectPackageManager(repoWith(["pyproject.toml"]))).toBe("pip");
  });

  it("prefers pnpm over a stray Python lockfile", () => {
    expect(detectPackageManager(repoWith(["pnpm-lock.yaml", "poetry.lock"]))).toBe("pnpm");
  });

  it("returns unknown for a bare repo", () => {
    expect(detectPackageManager(repoWith([]))).toBe("unknown");
  });
});
