// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Solidity parser: imports (import_directive) and exports
// (contract/interface/library declarations, public functions).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type !== "import_directive") return;
    const src = node.childForFieldName("source");
    if (!src) return;
    imports.push({
      source: src.text.replace(/^["']|["']$/g, ""),
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
    if (["contract_declaration", "interface_declaration", "library_declaration"].includes(node.type)) {
      const name = node.childForFieldName("name");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
      return;
    }
    if (node.type === "function_definition") {
      const name = node.childForFieldName("name");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });
  return exports;
}

export const parseSolidity = makeTreeSitterParser({
  wasmFile: "tree-sitter-solidity.wasm",
  supportedLanguage: "solidity",
  extensions: [".sol"],
  extractImports,
  extractExports,
});