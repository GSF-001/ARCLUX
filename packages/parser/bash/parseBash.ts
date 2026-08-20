// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Bash/shell parser: imports (source/require via command_name) and
// exports (function_definition names, exported variables).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type !== "command") return;
    const name = node.childForFieldName("name");
    if (!name) return;
    const cmd = name.text;
    if (!["source", ".", "require"].includes(cmd)) return;
    const arg = findChild(node, ["string", "word", "raw_string"]);
    if (!arg) return;
    imports.push({
      source: arg.text.replace(/^["']|["']$/g, ""),
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
      const name = node.childForFieldName("name");
      if (name) exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });
  return exports;
}

export const parseBash = makeTreeSitterParser({
  wasmFile: "tree-sitter-bash.wasm",
  supportedLanguage: "bash",
  extensions: [".sh", ".bash"],
  extractImports,
  extractExports,
});