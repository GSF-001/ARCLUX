/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Real-mechanics tests for the five new language parsers (php/ruby/rust/
 * cpp/csharp). Each gets a positive case: known source → exact
 * imports/exports, proving the tree-sitter extraction actually works.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FileInfo } from "../packages/shared/types";
import { parsePhp } from "../packages/parser/php/parsePhp";
import { parseRuby } from "../packages/parser/ruby/parseRuby";
import { parseRust } from "../packages/parser/rust/parseRust";
import { parseCpp } from "../packages/parser/cpp/parseCpp";
import { parseCSharp } from "../packages/parser/csharp/parseCSharp";

function file(relativePath: string, language: string, extension: string): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language,
    extension,
    sizeBytes: 1,
    hash: `hash-${relativePath}`,
  };
}

describe("parsePhp", () => {
  it("extracts use imports and function/class/interface exports", async () => {
    const src = readFileSync(join(__dirname, "fixtures", "php-basic", "app.php"), "utf-8");
    const result = await parsePhp.parse(file("app.php", "php", ".php"), src);
    expect(result.imports.map((i) => i.source)).toEqual([
      "App\\Models\\User",
      "Illuminate\\Support\\Facades\\DB as Database",
    ]);
    expect(result.exports.map((e) => e.name)).toEqual(["greet", "UserController", "Repository"]);
  });

  it("ignores non-declaration content", async () => {
    const result = await parsePhp.parse(file("x.php", "php", ".php"), "<?php $x = 1; echo $x;");
    expect(result.imports).toHaveLength(0);
    expect(result.exports).toHaveLength(0);
  });
});

describe("parseRuby", () => {
  it("extracts require imports and class/module/method exports", async () => {
    const src = readFileSync(join(__dirname, "fixtures", "ruby-basic", "app.rb"), "utf-8");
    const result = await parseRuby.parse(file("app.rb", "ruby", ".rb"), src);
    expect(result.imports.map((i) => i.source)).toEqual(["json", "./lib/helper"]);
    expect(result.exports.map((e) => e.name)).toEqual(["User", "full_name", "Auth", "login"]);
  });
});

describe("parseRust", () => {
  it("extracts use imports and pub-only exports", async () => {
    const src = readFileSync(join(__dirname, "fixtures", "rust-basic", "lib.rs"), "utf-8");
    const result = await parseRust.parse(file("lib.rs", "rust", ".rs"), src);
    expect(result.imports.map((i) => i.source)).toEqual([
      "std::collections::HashMap",
      "crate::models::{User, Post}",
    ]);
    // private_helper is NOT pub — must not appear.
    expect(result.exports.map((e) => e.name)).toEqual(["greet", "Config"]);
  });
});

describe("parseCpp", () => {
  it("extracts #include imports and class/struct exports", async () => {
    const src = readFileSync(join(__dirname, "fixtures", "cpp-basic", "main.cpp"), "utf-8");
    const result = await parseCpp.parse(file("main.cpp", "cpp", ".cpp"), src);
    expect(result.imports.map((i) => i.source)).toEqual(["vector", "local/helper.hpp"]);
    expect(result.exports.map((e) => e.name)).toEqual(["Config", "Point"]);
  });
});

describe("parseCSharp", () => {
  it("extracts using imports and public exports", async () => {
    const src = readFileSync(join(__dirname, "fixtures", "csharp-basic", "App.cs"), "utf-8");
    const result = await parseCSharp.parse(file("App.cs", "csharp", ".cs"), src);
    expect(result.imports.map((i) => i.source)).toEqual(["System", "System.Collections.Generic"]);
    // Secret() is private — must not appear.
    expect(result.exports.map((e) => e.name)).toEqual(["User", "Save", "IRepo"]);
  });
});