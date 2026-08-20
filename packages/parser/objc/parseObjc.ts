// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Objective-C parser: imports (#import/#include) and exports
// (@interface/@implementation class names).

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
    if (node.type === "class_interface" || node.type === "class_implementation") {
      const name = findChild(node, ["identifier"]);
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
      return;
    }
    if (node.type === "protocol_declaration") {
      const name = findChild(node, ["identifier"]);
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });
  return exports;
}

export const parseObjc = makeTreeSitterParser({
  wasmFile: "tree-sitter-objc.wasm",
  supportedLanguage: "objc",
  extensions: [".m", ".mm"],
  extractImports,
  extractExports,
});