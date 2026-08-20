// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Ruby language parser: imports (require/require_relative/load) and
// exports (class/module/def declarations). Tree-sitter based, following
// the parsePython.ts extraction style.

import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";
import { getTreeSitterRuntime, walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

async function extractImports(content: string): Promise<RawImport[]> {
  const { parser } = await getTreeSitterRuntime("tree-sitter-ruby.wasm");
  const tree = parser.parse(content);
  const imports: RawImport[] = [];

  walk(tree.rootNode, (node) => {
    // require "foo" / require_relative "../bar" / load "baz.rb"
    if (node.type !== "call") return;
    const method = node.childForFieldName("method");
    if (!method) return;
    const methodName = method.text;
    if (!["require", "require_relative", "load"].includes(methodName)) return;

    let source = "";
    for (const arg of node.namedChildren) {
      if (!arg) continue;
      if (arg.type === "string") {
        source = arg.text.replace(/^["']|["']$/g, "");
        break;
      }
      if (arg.type === "argument_list") {
        for (const inner of arg.namedChildren) {
          if (inner && inner.type === "string") {
            source = inner.text.replace(/^["']|["']$/g, "");
            break;
          }
        }
        if (source) break;
      }
    }
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
  const { parser } = await getTreeSitterRuntime("tree-sitter-ruby.wasm");
  const tree = parser.parse(content);
  const exports: RawExport[] = [];

  walk(tree.rootNode, (node) => {
    // class Foo / module Bar / def baz — top-level and nested.
    if (["class", "module", "method"].includes(node.type)) {
      const name = node.childForFieldName("name");
      if (!name) return;
      exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
    }
  });

  return exports;
}

export const parseRuby: LanguageParser = {
  supportedLanguages: ["ruby"],
  extensions: [".rb"],

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