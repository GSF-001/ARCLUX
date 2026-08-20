// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Dart parser: imports (import/export directives) and exports
// (class/function/top-level declarations).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type !== "library_import") return;
    const spec = findChild(node, ["import_specification"]);
    if (!spec) return;
    let src: TSNode | null = null;
    walk(spec, (n) => {
      if (!src && n.type === "string_literal") src = n;
    });
    if (!src) return;
    const sourceText = (src as TSNode).text;
    imports.push({
      source: sourceText.replace(/^['"]|['"]$/g, ""),
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
    if (node.type === "class_definition") {
      const name = node.childForFieldName("name");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
      return;
    }
    if (node.type === "function_signature") {
      const name = node.childForFieldName("name");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });
  return exports;
}

export const parseDart = makeTreeSitterParser({
  wasmFile: "tree-sitter-dart.wasm",
  supportedLanguage: "dart",
  extensions: [".dart"],
  extractImports,
  extractExports,
});