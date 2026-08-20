// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Kotlin parser: imports (import_header) and exports
// (class/object/function/interface declarations).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type !== "import_header") return;
    const name = node.childForFieldName("name") ?? findChild(node, ["identifier"]);
    if (!name) return;
    imports.push({
      source: name.text,
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
    if (["class_declaration", "object_declaration", "interface_declaration"].includes(node.type)) {
      const name = findChild(node, ["type_identifier", "simple_identifier"]);
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
      return;
    }
    if (node.type === "function_declaration") {
      const name = findChild(node, ["simple_identifier"]);
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });
  return exports;
}

export const parseKotlin = makeTreeSitterParser({
  wasmFile: "tree-sitter-kotlin.wasm",
  supportedLanguage: "kotlin",
  extensions: [".kt", ".kts"],
  extractImports,
  extractExports,
});