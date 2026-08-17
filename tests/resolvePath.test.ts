// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unit tests for packages/graph/resolvePath.ts. Covers the Python
// package-relative forms (issue #429): dots WITHOUT a slash (".x",
// "..utils", bare "."/".."), which posix.normalize cannot handle — plus
// JS/TS regression guards ("./x", "../x") to prove the JS branch is
// untouched, and the existing Python dotted-absolute path.

import { describe, it, expect } from "vitest";
import { resolvePath } from "../packages/graph/resolvePath";

function knownFiles(...files: string[]): Set<string> {
  return new Set(files);
}

describe("resolvePath — Python package-relative imports (issue #429)", () => {
  it("resolves `from .sub import` as a sibling module", () => {
    const files = knownFiles("pkg/service.py", "pkg/repository.py");
    expect(resolvePath("pkg/service.py", ".repository", files)).toEqual({
      type: "internal",
      moduleId: "pkg/repository.py",
    });
  });

  it("resolves `from ..module import` one package level up", () => {
    const files = knownFiles("utils.py", "pkg/repository.py");
    expect(resolvePath("pkg/repository.py", "..utils", files)).toEqual({
      type: "internal",
      moduleId: "utils.py",
    });
  });

  it("resolves `from ...pkg.sub import` two package levels up", () => {
    const files = knownFiles("a/pkg/utils.py", "a/b/c/mod.py");
    expect(resolvePath("a/b/c/mod.py", "...pkg.utils", files)).toEqual({
      type: "internal",
      moduleId: "a/pkg/utils.py",
    });
  });

  it("resolves `from ..pkg.sub import` to the parent package's subtree", () => {
    const files = knownFiles("a/pkg/utils.py", "a/b/mod.py");
    expect(resolvePath("a/b/mod.py", "..pkg.utils", files)).toEqual({
      type: "internal",
      moduleId: "a/pkg/utils.py",
    });
  });

  it("resolves bare `from . import` to the package __init__", () => {
    const files = knownFiles("pkg/__init__.py", "pkg/mod.py");
    expect(resolvePath("pkg/mod.py", ".", files)).toEqual({
      type: "internal",
      moduleId: "pkg/__init__.py",
    });
  });

  it("resolves bare `from .. import` to the parent package __init__", () => {
    const files = knownFiles("__init__.py", "pkg/mod.py");
    expect(resolvePath("pkg/mod.py", "..", files)).toEqual({
      type: "internal",
      moduleId: "__init__.py",
    });
  });

  it("returns external when the relative target does not exist", () => {
    const files = knownFiles("pkg/mod.py");
    expect(resolvePath("pkg/mod.py", "..missing", files)).toEqual({
      type: "external",
      packageName: "..missing",
    });
  });
});

describe("resolvePath — JS/TS relative imports (regression guards)", () => {
  it("still resolves `./x` exactly as before", () => {
    const files = knownFiles("pkg/service.ts", "pkg/entry.ts");
    expect(resolvePath("pkg/entry.ts", "./service", files)).toEqual({
      type: "internal",
      moduleId: "pkg/service.ts",
    });
  });

  it("still resolves `../x` exactly as before", () => {
    const files = knownFiles("lib/util.ts", "pkg/entry.ts");
    expect(resolvePath("pkg/entry.ts", "../lib/util", files)).toEqual({
      type: "internal",
      moduleId: "lib/util.ts",
    });
  });

  it("still treats bare specifiers as external packages", () => {
    const files = knownFiles("pkg/entry.ts");
    expect(resolvePath("pkg/entry.ts", "react", files)).toEqual({
      type: "external",
      packageName: "react",
    });
  });
});

describe("resolvePath — Python dotted absolute (existing behavior guard)", () => {
  it("resolves `pkg.service` from a root-level file", () => {
    const files = knownFiles("pkg/service.py", "app.py");
    expect(resolvePath("app.py", "pkg.service", files)).toEqual({
      type: "internal",
      moduleId: "pkg/service.py",
    });
  });
});

describe("resolvePath — ESM .js extension substitution (NodeNext)", () => {
  it("resolves ./index.js to the .ts implementation file", () => {
    const files = knownFiles("src/core/index.ts", "src/core/config.ts");
    expect(resolvePath("src/core/config.ts", "./index.js", files)).toEqual({
      type: "internal",
      moduleId: "src/core/index.ts",
    });
  });

  it("resolves ../../types.js across directories", () => {
    const files = knownFiles("src/types.ts", "src/adapters/aws/dynamodb.ts");
    expect(resolvePath("src/adapters/aws/dynamodb.ts", "../../types.js", files)).toEqual({
      type: "internal",
      moduleId: "src/types.ts",
    });
  });

  it("resolves .mjs to .mts and .cjs to .cts", () => {
    const files = knownFiles("src/mod.mts", "src/addon.cts", "src/main.ts");
    expect(resolvePath("src/main.ts", "./mod.mjs", files)).toEqual({
      type: "internal",
      moduleId: "src/mod.mts",
    });
    expect(resolvePath("src/main.ts", "./addon.cjs", files)).toEqual({
      type: "internal",
      moduleId: "src/addon.cts",
    });
  });

  it("prefers a real .js file over a .ts sibling", () => {
    const files = knownFiles("src/index.ts", "src/index.js", "src/config.ts");
    expect(resolvePath("src/config.ts", "./index.js", files)).toEqual({
      type: "internal",
      moduleId: "src/index.js",
    });
  });

  it("does not resolve a bare specifier to the importing file itself (npm pkg name == file name)", () => {
    const files = knownFiles("src/adapters/db/mongodb.ts");
    expect(resolvePath("src/adapters/db/mongodb.ts", "mongodb", files)).toEqual({
      type: "external",
      packageName: "mongodb",
    });
  });
});
