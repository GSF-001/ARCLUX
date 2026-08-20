// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// OCaml parser: imports (open/include modules) and exports
// (module/value definitions).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type === "open_module" || node.type === "include_module") {
      const path = findChild(node, ["module_path", "module_name"]);
      if (!path) return;
      imports.push({
        source: path.text,
        kind: "static",
        namedImports: [],
        hasDefaultImport: false,
        hasNamespaceImport: false,
        line: nodeLine(node),
      });
    }
  });
  return imports;
}

function extractExports(root: TSNode): RawExport[] {
  const exports: RawExport[] = [];
  walk(root, (node) => {
    if (node.type === "module_definition") {
      const binding = findChild(node, ["module_binding"]);
      if (!binding) return;
      const name = binding.childForFieldName("name");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
      return;
    }
    if (node.type === "value_definition") {
      const binding = findChild(node, ["let_binding"]);
      if (!binding) return;
      const name = binding.childForFieldName("pattern");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });
  return exports;
}

export const parseOcaml = makeTreeSitterParser({
  wasmFile: "tree-sitter-ocaml.wasm",
  supportedLanguage: "ocaml",
  extensions: [".ml", ".mli"],
  extractImports,
  extractExports,
});