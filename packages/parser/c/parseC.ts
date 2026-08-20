// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// C language parser: imports (#include) and exports
// (function/struct/union/enum/typedef declarations).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type !== "preproc_include") return;
    const pathNode = node.childForFieldName("path");
    if (!pathNode) return;
    imports.push({
      source: pathNode.text.replace(/^["<]|[">]$/g, ""),
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
    if (node.type === "function_definition") {
      const declarator = node.childForFieldName("declarator");
      if (!declarator) return;
      const fnName = findChild(declarator, ["identifier", "field_identifier"]);
      if (fnName) exports.push({ name: fnName.text, kind: "named", line: nodeLine(fnName) });
      return;
    }
    if (["struct_specifier", "union_specifier", "enum_specifier", "type_definition"].includes(node.type)) {
      const name = findChild(node, ["type_identifier", "identifier"]);
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });
  return exports;
}

export const parseC = makeTreeSitterParser({
  wasmFile: "tree-sitter-c.wasm",
  supportedLanguage: "c",
  extensions: [".c", ".h"],
  extractImports,
  extractExports,
});