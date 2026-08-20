// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Rust language parser: imports (use statements) and exports
// (pub fn/struct/enum/trait/mod declarations). Tree-sitter based,
// following the parsePython.ts extraction style.

import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";
import { getTreeSitterRuntime, walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

async function extractImports(content: string): Promise<RawImport[]> {
  const { parser } = await getTreeSitterRuntime("tree-sitter-rust.wasm");
  const tree = parser.parse(content);
  const imports: RawImport[] = [];

  walk(tree.rootNode, (node) => {
    if (node.type !== "use_declaration") return;
    const argument = node.childForFieldName("argument");
    if (!argument) return;
    imports.push({
      source: argument.text,
      kind: "static",
      namedImports: [],
      hasDefaultImport: false,
      hasNamespaceImport: false,
      line: nodeLine(node),
    });
  });

  return imports;
}

async function extractExports(content: string): Promise<RawExport[]> {
  const { parser } = await getTreeSitterRuntime("tree-sitter-rust.wasm");
  const tree = parser.parse(content);
  const exports: RawExport[] = [];

  const ITEM_TYPES = new Set([
    "function_item",
    "struct_item",
    "enum_item",
    "trait_item",
    "mod_item",
    "type_item",
    "const_item",
    "static_item",
  ]);

  walk(tree.rootNode, (node) => {
    if (!ITEM_TYPES.has(node.type)) return;
    // Only pub items are externally visible in Rust.
    const isPub = node.namedChildren.some(
      (c) => c && (c.type === "visibility_modifier" || c.type === "pub")
    );
    if (!isPub) return;
    const name = node.childForFieldName("name");
    if (!name) return;
    exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
  });

  return exports;
}

export const parseRust: LanguageParser = {
  supportedLanguages: ["rust"],
  extensions: [".rs"],

  async parse(file: FileInfo, content: string): Promise<ParsedFile> {
    const [imports, exportsList] = await Promise.all([
      extractImports(content),
      extractExports(content),
    ]);
    return {
      file,
      imports,
      exports: exportsList,
      warnings: [],
    };
  },
}