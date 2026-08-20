// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureParsersRegistered } from "../packages/engine/pipeline";
import { parserRegistry } from "../packages/parser/core/ParserRegistry";

const fixture = (lang: string, file: string) =>
  readFileSync(join(__dirname, "fixtures", lang, file), "utf8");

async function parseOne(extension: string, content: string) {
  const parser = parserRegistry.getParserForExtension(extension);
  const result = await parser.parse({ path: `test${extension}`, content, language: "unknown" }, content);
  return result;
}

describe("new language parsers (PR #529 batch)", () => {
  beforeAll(() => {
    ensureParsersRegistered();
  });

  it("bash: source imports + function exports", async () => {
    const r = await parseOne(".sh", fixture("bash-basic", "lib.sh"));
    expect(r.imports.map((i) => i.source)).toEqual(["helpers.sh", "./other.sh"]);
    expect(r.exports.map((e) => e.name)).toContain("greet");
  });

  it("c: include imports + function/struct/typedef exports", async () => {
    const r = await parseOne(".c", fixture("c-basic", "point.c"));
    expect(r.imports.map((i) => i.source)).toEqual(["stdio.h", "point.h"]);
    const names = r.exports.map((e) => e.name);
    expect(names).toContain("Point");
    expect(names).toContain("main");
  });

  it("dart: import directives + class/function exports", async () => {
    const r = await parseOne(".dart", fixture("dart-basic", "main.dart"));
    expect(r.imports.map((i) => i.source)).toEqual(["dart:io", "pkg/foo.dart"]);
    expect(r.exports.map((e) => e.name)).toEqual(expect.arrayContaining(["User", "main"]));
  });

  it("elixir: import/require/alias + defmodule exports", async () => {
    const r = await parseOne(".ex", fixture("elixir-basic", "app.ex"));
    expect(r.imports.map((i) => i.source)).toEqual(["Enum", "List", "Logger"]);
    expect(r.exports.map((e) => e.name)).toEqual(["App"]);
  });

  it("kotlin: import_header + class/fun exports", async () => {
    const r = await parseOne(".kt", fixture("kotlin-basic", "main.kt"));
    expect(r.imports.map((i) => i.source)).toEqual([
      "kotlin.math.max",
      "com.foo.Bar",
    ]);
    expect(r.exports.map((e) => e.name)).toEqual(expect.arrayContaining(["User", "main"]));
  });

  it("lua: require imports + function exports", async () => {
    const r = await parseOne(".lua", fixture("lua-basic", "main.lua"));
    expect(r.imports.map((i) => i.source)).toEqual(["foo", "bar"]);
    expect(r.exports.map((e) => e.name)).toEqual(["greet"]);
  });

  it("objc: #import + class exports", async () => {
    const r = await parseOne(".m", fixture("objc-basic", "App.m"));
    expect(r.imports.map((i) => i.source)).toEqual(["Foundation/Foundation.h", "Local.h"]);
    expect(r.exports.map((e) => e.name)).toEqual(["Foo"]);
  });

  it("ocaml: open/include + module/value exports", async () => {
    const r = await parseOne(".ml", fixture("ocaml-basic", "main.ml"));
    expect(r.imports.map((i) => i.source)).toEqual(["List", "Set"]);
    expect(r.exports.map((e) => e.name)).toEqual(expect.arrayContaining(["M", "x"]));
  });

  it("scala: import_declaration + class/object exports", async () => {
    const r = await parseOne(".scala", fixture("scala-basic", "Main.scala"));
    expect(r.imports.map((i) => i.source)).toEqual([
      "scala.collection.mutable",
      "java.util",
    ]);
    expect(r.exports.map((e) => e.name)).toEqual(expect.arrayContaining(["User", "Main"]));
  });

  it("solidity: import_directive + contract exports", async () => {
    const r = await parseOne(".sol", fixture("solidity-basic", "Token.sol"));
    expect(r.imports.map((i) => i.source)).toEqual(["./TokenBase.sol", "./c.sol"]);
    expect(r.exports.map((e) => e.name)).toContain("Token");
  });

  it("swift: import_declaration + class/struct exports", async () => {
    const r = await parseOne(".swift", fixture("swift-basic", "App.swift"));
    expect(r.imports.map((i) => i.source)).toEqual(["Foundation", "UIKit"]);
    expect(r.exports.map((e) => e.name)).toEqual(expect.arrayContaining(["User", "Point"]));
  });

  it("vue: script imports/exports via JS extractors", async () => {
    const r = await parseOne(".vue", fixture("vue-basic", "App.vue"));
    expect(r.imports.map((i) => i.source)).toContain("./Foo.vue");
    expect(r.exports.map((e) => e.name)).toContain("default");
  });

  it("zig: @import imports + pub-only exports", async () => {
    const r = await parseOne(".zig", fixture("zig-basic", "main.zig"));
    expect(r.imports.map((i) => i.source)).toEqual(["std", "local.zig"]);
    expect(r.exports.map((e) => e.name)).toEqual(["main"]);
  });
});