// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Swift parser: imports (import_declaration) and exports
// (class/struct/enum/protocol/function declarations).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type !== "import_declaration") return;
    const id = findChild(node, ["identifier"]);
    if (!id) return;
    imports.push({
      source: id.text,
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
    if (["class_declaration", "struct_declaration", "enum_declaration", "protocol_declaration"].includes(node.type)) {
      const name = node.childForFieldName("name");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
      return;
    }
    if (node.type === "function_declaration") {
      const name = node.childForFieldName("name");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });
  return exports;
}

export const parseSwift = makeTreeSitterParser({
  wasmFile: "tree-sitter-swift.wasm",
  supportedLanguage: "swift",
  extensions: [".swift"],
  extractImports,
  extractExports,
});