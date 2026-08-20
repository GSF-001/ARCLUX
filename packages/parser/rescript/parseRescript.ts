// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// ReScript parser: imports (open/include statements, require calls) and
// exports (let/module declarations).
//
// NOTE: the wasm in tree-sitter-wasms predates ReScript's `import`
// statement syntax — those files produce ERROR nodes and are skipped.
// open/include/require are still the supported import forms here.

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type === "open_statement" || node.type === "include_statement") {
      const name = findChild(node, ["module_identifier_path", "module_identifier"]);
      if (name) {
        imports.push({
          source: name.text,
          kind: "static",
          namedImports: [],
          hasDefaultImport: false,
          hasNamespaceImport: false,
          line: nodeLine(node),
        });
      }
      return;
    }
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      if (!fn) return;
      if (fn.type !== "value_identifier" || fn.text !== "require") return;
      const args = findChild(node, ["arguments"]);
      if (!args) return;
      const str = findChild(args, ["string"]);
      if (!str) return;
      const frag = findChild(str, ["string_fragment"]);
      imports.push({
        source: (frag ?? str).text,
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
    if (node.type === "let_declaration") {
      const binding = findChild(node, ["let_binding"]);
      if (!binding) return;
      const name = binding.childForFieldName("pattern");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
      return;
    }
    if (node.type === "module_declaration") {
      const binding = findChild(node, ["module_binding"]);
      if (!binding) return;
      const name = binding.childForFieldName("name");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });
  return exports;
}

export const parseRescript = makeTreeSitterParser({
  wasmFile: "tree-sitter-rescript.wasm",
  supportedLanguage: "rescript",
  extensions: [".res", ".resi"],
  extractImports,
  extractExports,
});