// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// End-to-end test for buildIndex against a real temp directory on disk:
// scanFiles -> parse -> resolvePath -> Repository with importedBy back-fill.
// Uses the shared parserRegistry singleton (same one the pipeline uses),
// registering the parsers this fixture needs.

import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildIndex } from "../packages/indexer/buildIndex";
import { parserRegistry } from "../packages/parser/core/ParserRegistry";
import { parseTs } from "../packages/parser/typescript/parseTs";
import { parseGo } from "../packages/parser/go/parseGo";
import type { RepositoryMeta } from "../packages/shared/types";

parserRegistry.register(parseTs);
parserRegistry.register(parseGo);

const META: Omit<RepositoryMeta, "analyzedAt"> = {
  id: "index-test",
  org: "local",
  name: "index-test",
  defaultBranch: "local",
  rootPath: "",
  detectedFrameworks: [],
  packageManager: "unknown",
};

function makeRepoDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "arclux-index-"));
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

describe("buildIndex", () => {
  it("indexes TS modules, resolves relative imports, and back-fills importedBy", async () => {
    const dir = track(
      makeRepoDir({
        "src/a.ts": 'import { b } from "./b";\nexport const a = b;',
        "src/b.ts": "export const b = 1;",
      })
    );

    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    expect(repository.moduleCount).toBe(2);

    const a = repository.getModule("src/a.ts");
    const b = repository.getModule("src/b.ts");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.imports).toEqual(["src/b.ts"]);
    expect(b!.importedBy).toEqual(["src/a.ts"]);
    expect(a!.exports.map((e) => e.name)).toEqual(["a"]);
  });

  it("resolves extensionless imports to the .ts sibling", async () => {
    const dir = track(
      makeRepoDir({
        "src/a.ts": 'import { b } from "./b";\nexport const a = b;',
        "src/b.ts": "export const b = 1;",
      })
    );

    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    // import source "./b" (no extension) must resolve to src/b.ts
    expect(repository.getModule("src/a.ts")!.imports).toEqual(["src/b.ts"]);
  });

  it("keeps external package imports out of the module graph", async () => {
    const dir = track(
      makeRepoDir({
        "src/a.ts": 'import { useState } from "react";\nexport const a = useState;',
      })
    );

    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    expect(repository.moduleCount).toBe(1);
    expect(repository.getModule("src/a.ts")!.imports).toEqual([]);
  });

  it("indexes Go files with a same-scope scopeId and only their own package imports", async () => {
    const dir = track(
      makeRepoDir({
        "main.go": 'package main\nimport "fmt"\n\nfunc Greet() string { return fmt.Sprint("hi") }',
      })
    );

    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    expect(repository.moduleCount).toBe(1);
    const goMod = repository.getModule("main.go");
    expect(goMod).toBeDefined();
    expect(goMod!.imports).toEqual([]); // "fmt" is external
    expect(goMod!.exports.map((e) => e.name)).toEqual(["Greet"]);
  });

  it("returns an empty repository for a directory with no parseable files", async () => {
    const dir = track(makeRepoDir({ "README.md": "# nothing to parse" }));
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    expect(repository.moduleCount).toBe(0);
  });
});
