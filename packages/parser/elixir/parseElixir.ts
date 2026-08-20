// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Elixir parser: imports (import/alias/require/use calls) and exports
// (defmodule/def/defp — only top-level modules, defs inside them).

import type { RawImport, RawExport } from "../../shared/types";
import { makeTreeSitterParser, findChild } from "../core/makeTreeSitterParser";
import { walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

function extractImports(root: TSNode): RawImport[] {
  const imports: RawImport[] = [];
  walk(root, (node) => {
    if (node.type !== "call") return;
    const target = node.childForFieldName("target");
    if (!target) return;
    const cmd = target.text;
    if (!["import", "alias", "require", "use"].includes(cmd)) return;
    const args = findChild(node, ["arguments"]);
    if (!args) return;
    const alias = findChild(args, ["alias"]);
    if (!alias) return;
    imports.push({
      source: alias.text.replace(/^["']|["']$/g, ""),
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
    if (node.type !== "call") return;
    const target = node.childForFieldName("target");
    if (!target) return;
    if (target.text === "defmodule") {
      const args = findChild(node, ["arguments"]);
      if (!args) return;
      const alias = findChild(args, ["alias"]);
      if (alias) exports.push({ name: alias.text, kind: "named", line: nodeLine(alias) });
    }
  });
  return exports;
}

export const parseElixir = makeTreeSitterParser({
  wasmFile: "tree-sitter-elixir.wasm",
  supportedLanguage: "elixir",
  extensions: [".ex", ".exs"],
  extractImports,
  extractExports,
});