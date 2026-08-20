// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Lua parser: imports (require calls) and exports
// (function_definition_statement names).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type !== "call") return;
    const fn = node.childForFieldName("function");
    if (!fn) return;
    const name = findChild(fn, ["identifier"]);
    if (!name || name.text !== "require") return;
    const args = findChild(node, ["argument_list"]);
    if (!args) return;
    const str = findChild(args, ["string", "expression_list"]);
    if (!str) return;
    imports.push({
      source: str.text.replace(/^['"]|['"]$/g, ""),
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
    if (node.type !== "function_definition_statement") return;
    const name = node.childForFieldName("name");
    if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
  });
  return exports;
}

export const parseLua = makeTreeSitterParser({
  wasmFile: "tree-sitter-lua.wasm",
  supportedLanguage: "lua",
  extensions: [".lua"],
  extractImports,
  extractExports,
});