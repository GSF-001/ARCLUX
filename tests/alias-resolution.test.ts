// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Coverage for issue #372: monorepo tsconfig path-alias resolution.
// loadAliasConfig used to read only the repo-root tsconfig, so apps/web's
// own "@/*" (pointing at apps/web/) was ignored and every "@/..." import
// inside apps/web resolved against the root's base → false-positive
// unusedExports/orphanFiles. These tests pin the merged-rules behavior.

import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadAliasConfig } from "../packages/graph/resolveAliases";
import { resolvePath } from "../packages/graph/resolvePath";

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function makeRepoDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "arclux-alias-"));
  tempDirs.push(dir);
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(dir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf-8");
  }
  return dir;
}

const ROOT_TSCONFIG = JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } });

const WEB_TSCONFIG = JSON.stringify({
  compilerOptions: {
    paths: { "@/*": ["./*"], "@/packages/*": ["../../packages/*"] },
  },
});

// Real Next.js-style config: include globs like "**/*.ts" contain the literal
// "*/" sequence, which the old regex-based comment stripper misread as the end
// of a block comment opened by "/*" in "@/*" — corrupting the JSON and making
// loadAliasConfig return empty rules (issue #372 root cause).
const NEXTJS_TSCONFIG = JSON.stringify({
  compilerOptions: {
    jsx: "preserve",
    moduleResolution: "bundler",
    paths: { "@/*": ["./*"] },
  },
  include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  exclude: ["node_modules"],
});

describe("loadAliasConfig — monorepo tsconfig merge (issue #372)", () => {
  it("reads only the root config when there is no apps/ directory (unchanged behavior)", () => {
    const root = makeRepoDir({ "tsconfig.json": ROOT_TSCONFIG });
    const config = loadAliasConfig(root);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].prefix).toBe("@/");
    expect(config.rules[0].targets).toEqual(["./"]);
  });

  it("merges apps/web/tsconfig.json rules with config-dir-relative bases", () => {
    const root = makeRepoDir({
      "tsconfig.json": ROOT_TSCONFIG,
      "apps/web/tsconfig.json": WEB_TSCONFIG,
    });
    const config = loadAliasConfig(root);
    const targetsFor = (prefix: string) =>
      config.rules.filter((r) => r.prefix === prefix).flatMap((r) => r.targets);
    // "@/*" from both configs: root's "./" AND apps/web's "apps/web/"
    expect(new Set(targetsFor("@/"))).toEqual(new Set(["./", "apps/web/"]));
    // "@/packages/*" from apps/web, rebased from apps/web → repo-root packages/
    expect(targetsFor("@/packages/")).toEqual(["packages/"]);
  });

  it("keeps longest-prefix-first ordering in the merged rule list", () => {
    const root = makeRepoDir({
      "tsconfig.json": ROOT_TSCONFIG,
      "apps/web/tsconfig.json": WEB_TSCONFIG,
    });
    expect(loadAliasConfig(root).rules[0].prefix).toBe("@/packages/");
  });

  it("ignores a malformed nested config and still returns the root rules", () => {
    const root = makeRepoDir({
      "tsconfig.json": ROOT_TSCONFIG,
      "apps/web/tsconfig.json": "{ this is not json !!!",
    });
    expect(loadAliasConfig(root).rules.some((r) => r.prefix === "@/")).toBe(true);
  });

  it("dedupes identical rules from tsconfig.json + jsconfig.json in the same dir", () => {
    const root = makeRepoDir({
      "tsconfig.json": ROOT_TSCONFIG,
      "jsconfig.json": ROOT_TSCONFIG, // same paths, same dir → identical after rebase
      "apps/web/tsconfig.json": WEB_TSCONFIG,
    });
    const config = loadAliasConfig(root);
    // "@/" rules: one from root (tsconfig+jsconfig deduped) + one from apps/web
    expect(config.rules.filter((r) => r.prefix === "@/")).toHaveLength(2);
  });

  it("returns empty rules for a repo with no tsconfig at all", () => {
    const root = makeRepoDir({});
    expect(loadAliasConfig(root).rules).toEqual([]);
  });

  it("parses a realistic Next.js config without corrupting @/* paths or include globs (issue #372 root cause)", () => {
    const root = makeRepoDir({ "tsconfig.json": NEXTJS_TSCONFIG });
    const config = loadAliasConfig(root);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].prefix).toBe("@/");
    expect(config.rules[0].targets).toEqual(["./"]);
  });

  it("strips real comments and trailing commas but not /* inside strings", () => {
    const withComments = `{
      // a line comment
      /* a block comment */
      "compilerOptions": {
        "paths": { "@/*": ["./*"] },
      },
      "include": ["**/*.ts"],
    }`;
    const root = makeRepoDir({ "tsconfig.json": withComments });
    const config = loadAliasConfig(root);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].prefix).toBe("@/");
    expect(config.rules[0].targets).toEqual(["./"]);
  });
});

describe("resolvePath with merged monorepo aliases (issue #372 false positives)", () => {
  it("resolves '@/...' imported inside apps/web to apps/web/, not repo root", () => {
    const root = makeRepoDir({
      "tsconfig.json": ROOT_TSCONFIG,
      "apps/web/tsconfig.json": WEB_TSCONFIG,
      "apps/web/components/layout/Navbar.ts": "export const Navbar = () => null;",
      "apps/web/pages/index.ts": "import Navbar from '@/components/layout/Navbar';",
    });
    const config = loadAliasConfig(root);
    const knownFiles = new Set(["apps/web/components/layout/Navbar.ts", "apps/web/pages/index.ts"]);
    const resolution = resolvePath("apps/web/pages/index.ts", "@/components/layout/Navbar", knownFiles, config);
    expect(resolution).toEqual({ type: "internal", moduleId: "apps/web/components/layout/Navbar.ts" });
  });

  it("resolves '@/packages/*' imported from apps/web to repo-root packages/", () => {
    const root = makeRepoDir({
      "tsconfig.json": ROOT_TSCONFIG,
      "apps/web/tsconfig.json": WEB_TSCONFIG,
      "packages/graph/buildDependencyGraph.ts": "export const x = 1;",
    });
    const config = loadAliasConfig(root);
    const knownFiles = new Set(["packages/graph/buildDependencyGraph.ts"]);
    const resolution = resolvePath("apps/web/lib/x.ts", "@/packages/graph/buildDependencyGraph", knownFiles, config);
    expect(resolution).toEqual({ type: "internal", moduleId: "packages/graph/buildDependencyGraph.ts" });
  });
});
