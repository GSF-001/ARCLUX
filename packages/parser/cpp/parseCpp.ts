// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// C++ language parser: imports (#include directives) and exports
// (class/struct/function/enum declarations, namespace-level). Tree-sitter
// based, following the parsePython.ts extraction style.

import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";
import { getTreeSitterRuntime, walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

async function extractImports(content: string): Promise<RawImport[]> {
  const { parser } = await getTreeSitterRuntime("tree-sitter-cpp.wasm");
  const tree = parser.parse(content);
  const imports: RawImport[] = [];

  walk(tree.rootNode, (node) => {
    // preproc_include: #include <vector> / #include "local.h"
    if (node.type !== "preproc_include") return;
    const pathNode = node.childForFieldName("path");
    if (!pathNode) return;
    const raw = pathNode.text;
    const source = raw.replace(/^["<]|[">]$/g, "");
    if (!source) return;
    imports.push({
      source,
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
  const { parser } = await getTreeSitterRuntime("tree-sitter-cpp.wasm");
  const tree = parser.parse(content);
  const exports: RawExport[] = [];

  walk(tree.rootNode, (node) => {
    // class Foo / struct Bar / enum Baz — only namespace-level (shallow)
    // declarations, so nested/anon types inside functions don't count.
    if (!["class_specifier", "struct_specifier", "enum_specifier"].includes(node.type)) return;
    const name = node.childForFieldName("name");
    if (!name || name.type !== "type_identifier") return;
    exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
  });

  return exports;
}

export const parseCpp: LanguageParser = {
  supportedLanguages: ["cpp"],
  extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx"],

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