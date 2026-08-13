// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the TypeScript parser (parseTs): import kinds (static,
// type-only, dynamic, require), export kinds (default/named/re-export),
// and the export * star form.

import { describe, it, expect } from "vitest";
import { parseTs } from "../../packages/parser/typescript/parseTs";
import type { FileInfo } from "../../packages/shared/types";

function makeFile(relativePath: string, extension = ".ts"): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language: "typescript",
    extension,
    sizeBytes: 100,
    hash: "fake-hash",
  };
}

async function parseTsSource(source: string, relativePath = "src/mod.ts") {
  return parseTs.parse(makeFile(relativePath), source);
}

describe("parseTs", () => {
  it("extracts static imports with default, named, and namespace bindings", async () => {
    const parsed = await parseTsSource(`
      import x, { y as z } from "mod";
      import * as ns from "ns";
      import type { T } from "types";
      const d = await import("dyn");
      const r = require("req");
    `);

    expect(parsed.imports).toHaveLength(5);
    const [mod, ns, typeOnly, dyn, req] = parsed.imports;

    expect(mod).toMatchObject({ source: "mod", kind: "static", hasDefaultImport: true, namedImports: ["z"] });
    expect(ns).toMatchObject({ source: "ns", kind: "static", hasNamespaceImport: true });
    expect(typeOnly).toMatchObject({ source: "types", kind: "type-only", namedImports: ["T"] });
    expect(dyn).toMatchObject({ source: "dyn", kind: "dynamic" });
    expect(req).toMatchObject({ source: "req", kind: "require" });
  });

  it("records 1-based line numbers for imports", async () => {
    const parsed = await parseTsSource('import a from "a";\nimport b from "b";');
    expect(parsed.imports[0].line).toBe(1);
    expect(parsed.imports[1].line).toBe(2);
  });

  it("extracts default, named, and interface exports", async () => {
    const parsed = await parseTsSource(`
      export default function Page() {}
      export const CONST = 1;
      export function fn() {}
      export class Cls {}
      export interface Iface {}
    `);

    const names = parsed.exports.map((e) => [e.name, e.kind]);
    expect(names).toContainEqual(["Page", "default"]);
    expect(names).toContainEqual(["CONST", "named"]);
    expect(names).toContainEqual(["fn", "named"]);
    expect(names).toContainEqual(["Cls", "named"]);
    expect(names).toContainEqual(["Iface", "named"]);
  });

  it("does not double-count `export default function` as a named export", async () => {
    const parsed = await parseTsSource("export default function Page() {}");
    const pageExports = parsed.exports.filter((e) => e.name === "Page");
    expect(pageExports).toHaveLength(1);
    expect(pageExports[0].kind).toBe("default");
  });

  it("extracts named re-exports with their source module", async () => {
    const parsed = await parseTsSource('export { a, b } from "./x";');
    expect(parsed.exports).toHaveLength(2);
    for (const exp of parsed.exports) {
      expect(exp.kind).toBe("re-export");
      expect(exp.reExportSource).toBe("./x");
    }
    expect(parsed.exports.map((e) => e.name)).toEqual(["a", "b"]);
  });

  it("extracts `export * from` as a star re-export", async () => {
    const parsed = await parseTsSource('export * from "./y";');
    expect(parsed.exports).toEqual([
      { name: "*", kind: "re-export", reExportSource: "./y", line: 1 },
    ]);
  });

  it("returns empty structures for an empty file", async () => {
    const parsed = await parseTsSource("");
    expect(parsed.imports).toEqual([]);
    expect(parsed.exports).toEqual([]);
    expect(parsed.warnings).toEqual([]);
  });
});
