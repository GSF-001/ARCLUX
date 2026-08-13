// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// End-to-end test for the pipeline entry point (analyzeRepository with
// localPath): framework detection from package.json, indexing, graph
// construction, and manifest dependency collection — all against a real
// temp directory. This is the same real path the CLI (analyze/verify/
// doctor) takes.

import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { basename } from "node:path";
import { analyzeRepository } from "../packages/engine/pipeline";

const tempDirs: string[] = [];
function makeRepoDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "arclux-pipeline-"));
  tempDirs.push(dir);
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(dir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf-8");
  }
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("analyzeRepository (localPath)", () => {
  it("detects frameworks from package.json and builds index + graph", async () => {
    const dir = makeRepoDir({
      "package.json": JSON.stringify({
        name: "demo-app",
        dependencies: { next: "^15.0.0", react: "^18.0.0", express: "^4.0.0" },
      }),
      "package-lock.json": JSON.stringify({ name: "demo-app", lockfileVersion: 3 }),
      "src/a.ts": 'import { b } from "./b";\nexport const a = b;',
      "src/b.ts": "export const b = 1;",
    });

    const result = await analyzeRepository({ localPath: dir });

    expect(result.meta.name).toBe(basename(dir));
    // FRAMEWORK_MARKERS order: nextjs -> express -> react
    expect(result.meta.detectedFrameworks).toEqual(["nextjs", "express", "react"]);
    expect(result.meta.packageManager).toBe("npm");
    expect(result.moduleCount).toBe(2);

    expect(result.repository.getModule("src/a.ts")!.imports).toEqual(["src/b.ts"]);
    expect(result.repository.getModule("src/b.ts")!.importedBy).toEqual(["src/a.ts"]);

    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0]).toMatchObject({ source: "src/a.ts", target: "src/b.ts" });
  });

  it("collects manifest dependencies from package.json", async () => {
    const dir = makeRepoDir({
      "package.json": JSON.stringify({
        name: "demo-app",
        dependencies: { next: "^15.0.0", react: "^18.0.0" },
      }),
      "src/index.ts": "export const x = 1;",
    });

    const result = await analyzeRepository({ localPath: dir });
    const names = result.dependencies.map((d) => d.name);
    expect(names).toContain("next");
    expect(names).toContain("react");
  });

  it("reports no frameworks for a repo without package.json", async () => {
    const dir = makeRepoDir({ "src/a.ts": "export const a = 1;" });
    const result = await analyzeRepository({ localPath: dir });
    expect(result.meta.detectedFrameworks).toEqual([]);
    expect(result.moduleCount).toBe(1);
  });
});
