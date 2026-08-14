// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the Laravel requireController rule (issue #53): routes are
// located as modules, their content is read from real files on disk (same
// tmp-dir fixture style as tests/indexer.test.ts), and controllers are
// cross-checked against app/Http/Controllers/ on the filesystem — PHP files
// are not indexed as modules today, so the rule's filesystem path is the
// one under test.

import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Repository } from "../packages/repository/Repository";
import { runRules } from "../packages/rules/RuleEngine";
import { requireController } from "../packages/rules/laravel/requireController";
import type { ModuleInfo, RepositoryMeta } from "../packages/shared/types";

function makeRepoDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "arclux-laravel-"));
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(dir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf-8");
  }
  return dir;
}

const tempDirs: string[] = [];
function track(dir: string): string {
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeModule(relativePath: string, rootPath: string): ModuleInfo {
  return {
    id: relativePath,
    file: {
      absolutePath: join(rootPath, relativePath),
      relativePath,
      language: "php",
      extension: ".php",
      sizeBytes: 100,
      hash: "fake-hash",
    },
    exports: [],
    resolvedReExports: {},
    importedBy: [],
    imports: [],
    resolvedImports: [],
    implicitDependencies: [],
  };
}

function makeRepository(rootPath: string, modules: ModuleInfo[]): Repository {
  const meta: RepositoryMeta = {
    id: "test-repo",
    org: "test-org",
    name: "test-repo",
    defaultBranch: "main",
    rootPath,
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

describe("laravel/requireController", () => {
  it("passes an array-callable route whose controller file exists", () => {
    const dir = track(
      makeRepoDir({
        "routes/web.php": `<?php\nRoute::get('/users', [UserController::class, 'index']);\n`,
        "app/Http/Controllers/UserController.php": `<?php\nclass UserController {}\n`,
      })
    );
    const repo = makeRepository(dir, [makeModule("routes/web.php", dir)]);
    expect(runRules(repo, [requireController], ["laravel"])).toHaveLength(0);
  });

  it("flags a route referencing a controller with no matching file (severity error)", () => {
    const dir = track(
      makeRepoDir({
        "routes/web.php": `<?php\nRoute::get('/users', [MissingController::class, 'index']);\n`,
      })
    );
    const repo = makeRepository(dir, [makeModule("routes/web.php", dir)]);
    const violations = runRules(repo, [requireController], ["laravel"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe("laravel/require-controller");
    expect(violations[0].filePath).toBe("routes/web.php");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("MissingController");
  });

  it("does not flag string callables in v1 (documented limitation)", () => {
    const dir = track(
      makeRepoDir({
        "routes/web.php": `<?php\nRoute::get('/users', 'UserController@index');\n`,
      })
    );
    const repo = makeRepository(dir, [makeModule("routes/web.php", dir)]);
    expect(runRules(repo, [requireController], ["laravel"])).toHaveLength(0);
  });

  it("does not flag closures in v1 (documented limitation)", () => {
    const dir = track(
      makeRepoDir({
        "routes/web.php": `<?php\nRoute::get('/', function () { return view('welcome'); });\n`,
      })
    );
    const repo = makeRepository(dir, [makeModule("routes/web.php", dir)]);
    expect(runRules(repo, [requireController], ["laravel"])).toHaveLength(0);
  });

  it("returns no violations when a repo has no route files at all", () => {
    const dir = track(makeRepoDir({ "src/main.php": `<?php\n` }));
    const repo = makeRepository(dir, [makeModule("src/main.php", dir)]);
    expect(runRules(repo, [requireController], ["laravel"])).toHaveLength(0);
  });

  it("flags every referenced controller when routes exist but the controllers dir does not", () => {
    const dir = track(
      makeRepoDir({
        "routes/web.php": `<?php\nRoute::get('/a', [AlphaController::class, 'index']);\nRoute::get('/b', [BetaController::class, 'show']);\n`,
        "routes/api.php": `<?php\nRoute::get('/c', [GammaController::class, 'store']);\n`,
      })
    );
    const repo = makeRepository(dir, [
      makeModule("routes/web.php", dir),
      makeModule("routes/api.php", dir),
    ]);
    const violations = runRules(repo, [requireController], ["laravel"]);
    expect(violations).toHaveLength(3);
    expect(violations.map((v) => v.filePath).sort()).toEqual(["routes/api.php", "routes/web.php", "routes/web.php"]);
    expect(violations.every((v) => v.severity === "error")).toBe(true);
  });

  it("extracts the basename from namespaced array callables", () => {
    const dir = track(
      makeRepoDir({
        "routes/web.php": `<?php\nRoute::get('/admin', [App\\Http\\Controllers\\Admin\\UserController::class, 'index']);\n`,
        "app/Http/Controllers/UserController.php": `<?php\nclass UserController {}\n`,
      })
    );
    const repo = makeRepository(dir, [makeModule("routes/web.php", dir)]);
    expect(runRules(repo, [requireController], ["laravel"])).toHaveLength(0);
  });

  it("does not run when the laravel framework is not detected", () => {
    const dir = track(
      makeRepoDir({
        "routes/web.php": `<?php\nRoute::get('/users', [MissingController::class, 'index']);\n`,
      })
    );
    const repo = makeRepository(dir, [makeModule("routes/web.php", dir)]);
    expect(runRules(repo, [requireController], ["react"])).toHaveLength(0);
  });
});
