// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the Python parser (parsePython, tree-sitter based): import
// statement forms, from-imports, aliased imports, and top-level
// function/class exports (including decorated definitions).

import { describe, it, expect } from "vitest";
import { parsePython } from "../../packages/parser/python/parsePython";
import type { FileInfo } from "../../packages/shared/types";

function makeFile(relativePath: string): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language: "python",
    extension: ".py",
    sizeBytes: 100,
    hash: "fake-hash",
  };
}

async function parsePythonSource(source: string, relativePath = "src/mod.py") {
  return parsePython.parse(makeFile(relativePath), source);
}

describe("parsePython", () => {
  it("extracts plain, dotted, and aliased imports", async () => {
    const parsed = await parsePythonSource(`
import os
import numpy as np
import a.b.c
`);
    const sources = parsed.imports.map((i) => i.source);
    expect(sources).toContain("os");
    expect(sources).toContain("numpy");
    expect(sources).toContain("a.b.c");
    expect(parsed.imports.every((i) => i.kind === "static")).toBe(true);
  });

  it("extracts from-imports with named bindings", async () => {
    const parsed = await parsePythonSource(`
from pathlib import Path
from typing import List, Dict
`);
    expect(parsed.imports).toHaveLength(2);
    const [pathlib, typing] = parsed.imports;
    expect(pathlib.source).toBe("pathlib");
    expect(pathlib.namedImports).toContain("Path");
    expect(typing.source).toBe("typing");
    expect(typing.namedImports).toContain("List");
    expect(typing.namedImports).toContain("Dict");
  });

  it("exports top-level functions and classes", async () => {
    const parsed = await parsePythonSource(`
def top_level():
    pass

class MyClass:
    pass
`);
    const names = parsed.exports.map((e) => e.name);
    expect(names).toContain("top_level");
    expect(names).toContain("MyClass");
  });

  it("exports decorated definitions (e.g. @dataclass)", async () => {
    const parsed = await parsePythonSource(`
from dataclasses import dataclass

@dataclass
class Point:
    x: int
`);
    expect(parsed.exports.map((e) => e.name)).toEqual(["Point"]);
  });

  it("does not export nested or assigned functions", async () => {
    const parsed = await parsePythonSource(`
def outer():
    def inner():
        pass
    return inner

fn = lambda: 1
`);
    const names = parsed.exports.map((e) => e.name);
    expect(names).toEqual(["outer"]);
  });

  it("skips imports under if TYPE_CHECKING (type-only, decision #458)", async () => {
    const parsed = await parsePythonSource(
      "from typing import TYPE_CHECKING\nif TYPE_CHECKING:\n    from B import something"
    );
    // Only the `from typing import TYPE_CHECKING` line itself is an edge;
    // the type-only import under the guard is not (decision #458).
    expect(parsed.imports.map((i) => i.source)).toEqual(["typing"]);
  });

  it("skips imports under if typing.TYPE_CHECKING as well", async () => {
    const parsed = await parsePythonSource(
      "import typing\nif typing.TYPE_CHECKING:\n    from B import something"
    );
    expect(parsed.imports.map((i) => i.source)).toEqual(["typing"]);
  });

  it("still extracts imports under non-TYPE_CHECKING conditions", async () => {
    const parsed = await parsePythonSource("if SOME_FLAG:\n    from B import something");
    expect(parsed.imports.map((i) => i.source)).toEqual(["B"]);
  });
});
