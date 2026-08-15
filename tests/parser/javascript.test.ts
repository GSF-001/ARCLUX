// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the JavaScript family of parsers (parseJs, parseJsx,
// parseCommonJs): ESM + CommonJS import/export extraction and JSX parsing.

import { describe, it, expect } from "vitest";
import { parseJs } from "../../packages/parser/javascript/parseJs";
import { parseJsx } from "../../packages/parser/javascript/parseJsx";
import { parseCommonJs } from "../../packages/parser/javascript/parseCommonJs";
import type { FileInfo } from "../../packages/shared/types";

function makeFile(relativePath: string, extension: string, language = "javascript"): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language,
    extension,
    sizeBytes: 100,
    hash: "fake-hash",
  };
}

describe("parseJs", () => {
  it("extracts ESM imports including dynamic import and require", async () => {
    const parsed = await parseJs.parse(
      makeFile("src/app.js", ".js"),
      'import React, { useState } from "react";\nconst dyn = await import("lazy");\nconst r = require("util");'
    );

    expect(parsed.imports).toHaveLength(3);
    expect(parsed.imports[0]).toMatchObject({ source: "react", kind: "static", hasDefaultImport: true, namedImports: ["useState"] });
    expect(parsed.imports[1]).toMatchObject({ source: "lazy", kind: "dynamic" });
    expect(parsed.imports[2]).toMatchObject({ source: "util", kind: "require" });
  });

  it("extracts default and named exports", async () => {
    const parsed = await parseJs.parse(
      makeFile("src/app.js", ".js"),
      "export default function App() {}\nexport const VERSION = 1;"
    );
    expect(parsed.exports).toContainEqual(expect.objectContaining({ name: "App", kind: "default" }));
    expect(parsed.exports).toContainEqual(expect.objectContaining({ name: "VERSION", kind: "named" }));
  });

  it("extracts CommonJS per-property exports (module.exports.x / exports.x)", async () => {
    const parsed = await parseJs.parse(
      makeFile("src/cjs.js", ".js"),
      "module.exports.helper = () => 1;\nexports.other = 2;"
    );
    const names = parsed.exports.map((e) => e.name);
    expect(names).toContain("helper");
    expect(names).toContain("other");
  });

  it("extracts star re-exports", async () => {
    const parsed = await parseJs.parse(makeFile("src/index.js", ".js"), 'export * from "./x";');
    expect(parsed.exports).toContainEqual(expect.objectContaining({ name: "*", kind: "re-export", reExportSource: "./x" }));
  });
});

describe("parseJsx", () => {
  it("parses JSX syntax and extracts imports/exports", async () => {
    const parsed = await parseJsx.parse(
      makeFile("src/Button.jsx", ".jsx", "jsx"),
      'import React from "react";\n\nexport default function Button() {\n  return <button>Click</button>;\n}'
    );
    expect(parsed.warnings).toEqual([]);
    expect(parsed.imports).toHaveLength(1);
    expect(parsed.imports[0].source).toBe("react");
    expect(parsed.exports).toContainEqual(expect.objectContaining({ name: "Button", kind: "default" }));
  });
});

describe("parseCommonJs", () => {
  it("handles .cjs files: require imports and per-property exports", async () => {
    const parsed = await parseCommonJs.parse(
      makeFile("src/legacy.cjs", ".cjs"),
      'const fs = require("fs");\nmodule.exports.readFile = fs.readFileSync;\nexports.SIZE = 1024;'
    );
    expect(parsed.imports).toHaveLength(1);
    expect(parsed.imports[0]).toMatchObject({ source: "fs", kind: "require" });
    const names = parsed.exports.map((e) => e.name);
    expect(names).toContain("readFile");
    expect(names).toContain("SIZE");
  });

  it("extracts whole-object exports: module.exports = { a, b } (issue #430)", async () => {
    const parsed = await parseCommonJs.parse(
      makeFile("src/obj.cjs", ".cjs"),
      "const a = 1; const b = 2;\nmodule.exports = { a, b };"
    );
    const names = parsed.exports.map((e) => e.name);
    expect(names).toEqual(["a", "b"]);
    expect(parsed.exports.every((e) => e.kind === "named")).toBe(true);
  });

  it("extracts whole-object exports with renamed keys: module.exports = { foo: renamed }", async () => {
    const parsed = await parseCommonJs.parse(
      makeFile("src/renamed.cjs", ".cjs"),
      "const renamed = 42;\nmodule.exports = { foo: renamed };"
    );
    // The EXPORTED name is the object key ("foo"), not the local binding.
    expect(parsed.exports.map((e) => e.name)).toEqual(["foo"]);
  });

  it("supports the shorthand-and-longhand mix and skips spreads (issue #430)", async () => {
    const parsed = await parseCommonJs.parse(
      makeFile("src/mix.cjs", ".cjs"),
      "const a = 1; const rest = { x: 1 };\nmodule.exports = { a, foo: rest, ...rest };"
    );
    expect(parsed.exports.map((e) => e.name)).toEqual(["a", "foo"]);
  });

  it("extracts methods and string keys in whole-object exports", async () => {
    const parsed = await parseCommonJs.parse(
      makeFile("src/methods.cjs", ".cjs"),
      'module.exports = { run() {}, "dash-key": 1 };'
    );
    expect(parsed.exports.map((e) => e.name)).toEqual(["run", "dash-key"]);
  });

  it("combines whole-object and per-property assignments", async () => {
    const parsed = await parseCommonJs.parse(
      makeFile("src/combined.cjs", ".cjs"),
      "module.exports = { a };\nmodule.exports.b = 2;"
    );
    expect(parsed.exports.map((e) => e.name)).toEqual(["a", "b"]);
  });

  it("handles bare `exports = { … }` assignment", async () => {
    const parsed = await parseCommonJs.parse(
      makeFile("src/exports-assign.cjs", ".cjs"),
      "exports = { a, b };"
    );
    expect(parsed.exports.map((e) => e.name)).toEqual(["a", "b"]);
  });
});
