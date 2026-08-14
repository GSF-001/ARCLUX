// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for issue #348: packages/language/ wraps packages/parser/* (via the
// shared ParserRegistry) and the indexed Repository — syntax parsing,
// symbol resolution, completion, formatting normalization, symbol diff.

import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex } from "../packages/indexer/buildIndex";
import { parserRegistry } from "../packages/parser/core/ParserRegistry";
import { parseTs } from "../packages/parser/typescript/parseTs";
import type { RepositoryMeta, FileInfo } from "../packages/shared/types";
import { SyntaxEngine } from "../packages/language/SyntaxEngine";
import { LanguageService } from "../packages/language/LanguageService";
import { CompletionEngine } from "../packages/language/CompletionEngine";
import { FormattingEngine } from "../packages/language/FormattingEngine";
import { diffSymbols, hasSymbolChanges } from "../packages/language/DiffEngine";

parserRegistry.register(parseTs);

const META: RepositoryMeta = {
  id: "local",
  org: "local",
  name: "fixture",
  defaultBranch: "local",
  rootPath: "",
  detectedFrameworks: [],
  packageManager: "npm",
  analyzedAt: new Date(0).toISOString(),
};

const tracked: string[] = [];
function makeRepoDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "arclux-lang-"));
  tracked.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

afterAll(() => {
  for (const dir of tracked) rmSync(dir, { recursive: true, force: true });
});

function fileInfo(relativePath: string, content: string): FileInfo {
  const extension = relativePath.slice(relativePath.lastIndexOf("."));
  return {
    absolutePath: join("/virtual", relativePath),
    relativePath,
    language: "typescript",
    extension,
    sizeBytes: Buffer.byteLength(content),
    hash: "",
  };
}

describe("SyntaxEngine (issue #348)", () => {
  it("parses a TS file into the shared ParsedFile shape", async () => {
    const engine = new SyntaxEngine();
    const parsed = await engine.parseFile(
      fileInfo("src/a.ts", 'import { b } from "./b";\nexport const a = b;'),
      'import { b } from "./b";\nexport const a = b;'
    );

    expect(parsed.exports.map((e) => e.name)).toContain("a");
    expect(parsed.imports[0].source).toBe("./b");
    expect(parsed.warnings).toEqual([]);
  });

  it("detects language from extension without parsing", () => {
    const engine = new SyntaxEngine();
    expect(engine.language(".ts")).toBe("typescript");
    expect(engine.language(".py")).toBe("python");
    expect(engine.language(".xyz")).toBe("unknown");
  });

  it("throws UNSUPPORTED_LANGUAGE for unknown extensions", async () => {
    const engine = new SyntaxEngine();
    await expect(
      engine.parseFile(fileInfo("x.xyz", "hello"), "hello")
    ).rejects.toThrow(/No parser registered/);
  });
});

describe("SymbolEngine via LanguageService (issue #348)", () => {
  it("resolves exports, importers and callers from an indexed repo", async () => {
    const dir = makeRepoDir({
      "src/a.ts": 'import { b } from "./b";\nexport const a = b;',
      "src/b.ts": "export const b = 1;",
    });
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });

    const service = new LanguageService({ repository });
    const symbols = service.getSymbols();
    const names = symbols.map((s) => s.name);

    expect(names).toContain("a");
    expect(names).toContain("b");

    const b = symbols.find((s) => s.name === "b")!;
    expect(b.moduleId).toBe("src/b.ts");
    expect(b.importedBy).toEqual(["src/a.ts"]);

    const consumers = service.consumers("src/b.ts");
    expect(consumers).toContain("src/a.ts");
  });

  it("findSymbol matches by name across modules", async () => {
    const dir = makeRepoDir({
      "src/a.ts": "export const shared = 1;",
      "src/b.ts": "export const shared = 2;",
    });
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    const service = new LanguageService({ repository });

    const matches = service.findSymbol("shared");
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.moduleId).sort()).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("CompletionEngine (issue #348)", () => {
  it("suggests repository symbols matching the prefix", async () => {
    const dir = makeRepoDir({
      "src/a.ts": 'import { useState } from "react";\nexport const a = useState;',
      "src/b.ts": "export const useState = 1;",
    });
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    const completion = new CompletionEngine(repository);

    const items = completion.complete("src/a.ts", "useSt");
    expect(items.map((i) => i.name)).toContain("useState");
  });

  it("marks suggestions from already-imported modules", async () => {
    const dir = makeRepoDir({
      "src/a.ts": 'import { helper } from "./helper";\nexport const a = helper;',
      "src/helper.ts": "export const helper = 1;\nexport const helper2 = 2;",
    });
    const repository = await buildIndex({ rootPath: dir, meta: { ...META, rootPath: dir } });
    const completion = new CompletionEngine(repository);

    const items = completion.complete("src/a.ts", "helper");
    const helper = items.find((i) => i.name === "helper");
    expect(helper?.alreadyImported).toBe(true);
  });
});

describe("FormattingEngine (issue #348)", () => {
  it("normalizes CRLF, strips trailing whitespace, ensures final newline", () => {
    const engine = new FormattingEngine();
    const out = engine.format("a\r\nb  \r\nc\r\n");
    expect(out).toBe("a\nb\nc\n");
  });

  it("expands tabs to spaces (default 2)", () => {
    const engine = new FormattingEngine();
    expect(engine.format("\tconst x = 1;\n")).toBe("  const x = 1;\n");
  });

  it("uses tabs when configured", () => {
    const engine = new FormattingEngine();
    expect(engine.format("    const x = 1;\n", { useTabs: true, tabWidth: 2 })).toBe("\t\tconst x = 1;\n");
  });
});

describe("DiffEngine (issue #348)", () => {
  it("reports added/removed exports and imports between versions", () => {
    const before = {
      file: fileInfo("src/a.ts", ""),
      imports: [{ source: "./b", kind: "static" as const, namedImports: ["b"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
      exports: [{ name: "a", kind: "named" as const, line: 2 }],
      warnings: [],
    };
    const after = {
      file: fileInfo("src/a.ts", ""),
      imports: [
        { source: "./b", kind: "static" as const, namedImports: ["b"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 },
        { source: "./c", kind: "static" as const, namedImports: [], hasDefaultImport: true, hasNamespaceImport: false, line: 2 },
      ],
      exports: [
        { name: "a", kind: "named" as const, line: 2 },
        { name: "c", kind: "named" as const, line: 3 },
      ],
      warnings: [],
    };

    const diff = diffSymbols(before, after);
    expect(diff.exportsAdded).toEqual(["c"]);
    expect(diff.importsAdded).toEqual(["./c"]);
    expect(diff.exportsKept).toEqual(["a"]);
    expect(diff.changeCount).toBe(2);
    expect(hasSymbolChanges(diff)).toBe(true);
  });

  it("reports no changes for identical symbol surfaces", () => {
    const version = {
      file: fileInfo("src/a.ts", ""),
      imports: [{ source: "./b", kind: "static" as const, namedImports: ["b"], hasDefaultImport: false, hasNamespaceImport: false, line: 1 }],
      exports: [{ name: "a", kind: "named" as const, line: 2 }],
      warnings: [],
    };
    const diff = diffSymbols(version, version);
    expect(diff.changeCount).toBe(0);
    expect(hasSymbolChanges(diff)).toBe(false);
  });
});
