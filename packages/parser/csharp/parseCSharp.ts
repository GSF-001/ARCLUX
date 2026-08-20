// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// C# language parser: imports (using directives) and exports
// (namespace/class/interface/enum/record declarations, public members).
// Tree-sitter based, following the parsePython.ts extraction style.

import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";
import { getTreeSitterRuntime, walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

async function extractImports(content: string): Promise<RawImport[]> {
  const { parser } = await getTreeSitterRuntime("tree-sitter-c_sharp.wasm");
  const tree = parser.parse(content);
  const imports: RawImport[] = [];

  walk(tree.rootNode, (node) => {
    // using System; / using System.Linq; / using Foo = Bar.Baz;
    if (node.type !== "using_directive") return;
    // The directive's target is its first named child: an identifier or
    // qualified_name (no field name on this grammar).
    const name = node.namedChildren.find((c) => c !== null);
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

async function extractExports(content: string): Promise<RawExport[]> {
  const { parser } = await getTreeSitterRuntime("tree-sitter-c_sharp.wasm");
  const tree = parser.parse(content);
  const exports: RawExport[] = [];

  const TYPE_DECLS = new Set([
    "class_declaration",
    "interface_declaration",
    "struct_declaration",
    "enum_declaration",
    "record_declaration",
  ]);

  walk(tree.rootNode, (node) => {
    if (TYPE_DECLS.has(node.type)) {
      const name = node.childForFieldName("name");
      if (name) {
        exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
      }
      return;
    }
    // Public methods: method_declaration with a public modifier.
    if (node.type === "method_declaration") {
      const modifiers = childrenOfType(node, ["modifier"]);
      const isPublic = modifiers.some((m) => m.text === "public");
      if (!isPublic) return;
      const name = node.childForFieldName("name");
      if (name) {
        exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
      }
    }
  });

  return exports;
}

function childrenOfType(node: TSNode, types: string[]): TSNode[] {
  const out: TSNode[] = [];
  for (const child of node.namedChildren) {
    if (child && types.includes(child.type)) out.push(child);
  }
  return out;
}

export const parseCSharp: LanguageParser = {
  supportedLanguages: ["csharp"],
  extensions: [".cs"],

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