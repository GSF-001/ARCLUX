// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Elm parser: imports (import_clause moduleName) and exports
// (value_declaration names, type aliases, custom types).
//
// Uses the VENDORED wasm (packages/parser/wasms/tree-sitter-elm.wasm):
// the npm tree-sitter-wasms build is ABI 12 and incompatible with
// web-tree-sitter (needs 13–15).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type !== "import_clause") return;
    const name = node.childForFieldName("moduleName");
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
    if (node.type === "value_declaration") {
      const fn = node.childForFieldName("functionDeclarationLeft");
      if (!fn) return;
      const name = findChild(fn, ["lower_case_identifier"]);
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
      return;
    }
    if (node.type === "type_alias_declaration" || node.type === "type_declaration") {
      const name = findChild(node, ["upper_case_qid", "upper_case_identifier"]);
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });
  return exports;
}

export const parseElm = makeTreeSitterParser({
  wasmFile: "tree-sitter-elm.wasm",
  supportedLanguage: "elm",
  extensions: [".elm"],
  extractImports,
  extractExports,
});