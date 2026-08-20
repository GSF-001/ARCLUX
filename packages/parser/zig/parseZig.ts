// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Zig parser: imports (@import builtin calls) and exports
// (pub fn / pub const declarations).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type !== "variable_declaration") return;
    const builtin = findChild(node, ["builtin_function"]);
    if (!builtin) return;
    const name = findChild(builtin, ["builtin_identifier"]);
    if (!name || name.text !== "@import") return;
    const args = findChild(builtin, ["arguments"]);
    if (!args) return;
    const str = findChild(args, ["string"]);
    if (!str) return;
    const content = findChild(str, ["string_content"]);
    imports.push({
      source: (content ?? str).text,
      kind: "static",
      namedImports: [],
      hasDefaultImport: false,
      hasNamespaceImport: false,
      line: nodeLine(node),
    });
  });
  return imports;
}

function extractExports(root: TSNode): RawExport[] {
  const exports: RawExport[] = [];
  walk(root, (node) => {
    if (node.type !== "function_declaration" && node.type !== "variable_declaration") return;
    if (!node.text.startsWith("pub ")) return;
    const name = node.childForFieldName("name");
    if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
  });
  return exports;
}

export const parseZig = makeTreeSitterParser({
  wasmFile: "tree-sitter-zig.wasm",
  supportedLanguage: "zig",
  extensions: [".zig"],
  extractImports,
  extractExports,
});