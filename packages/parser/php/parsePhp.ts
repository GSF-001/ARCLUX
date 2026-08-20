// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// General-purpose PHP language parser: imports (use statements) and
// exports (function/class/interface/trait/enum declarations) across ALL
// .php files. Distinct from parsePhpRoutes.ts, which only reads
// routes/web.php + routes/api.php for controller references (that parser
// stays narrow on purpose).
//
// Was deferred until issue #53 (parsePhpRoutes conventions) landed — it
// has, so this file follows the same tree-sitter extraction style as
// parsePython.ts (walk the AST, collect nodes by type).

import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";
import { getTreeSitterRuntime, walk, nodeLine, type TSNode } from "../core/treeSitterLoader";

async function extractImports(content: string): Promise<RawImport[]> {
  const { parser } = await getTreeSitterRuntime("tree-sitter-php.wasm");
  const tree = parser.parse(content);
  const imports: RawImport[] = [];

  walk(tree.rootNode, (node) => {
    // namespace_use_clause: use Foo\Bar\Baz; / use Foo\Bar as Alias;
    if (node.type === "namespace_use_clause") {
      const qualified = node.childForFieldName("name");
      const source = qualified ? qualified.text.replace(/^\\/, "") : node.text;
      imports.push({
        source,
        kind: "static",
        namedImports: [],
        hasDefaultImport: false,
        hasNamespaceImport: false,
        line: nodeLine(node),
      });
    }
    // namespace_use_group: use Foo\{Bar, Baz};
    if (node.type === "namespace_use_group") {
      const prefix = node.childForFieldName("name");
      const prefixText = prefix ? prefix.text.replace(/^\\/, "") : "";
      for (const clause of node.namedChildren) {
        if (clause && clause.type === "namespace_use_clause") {
          const name = clause.childForFieldName("name");
          const leaf = name ? name.text : clause.text;
          imports.push({
            source: prefixText ? `${prefixText}\\${leaf}` : leaf,
            kind: "static",
            namedImports: [],
            hasDefaultImport: false,
            hasNamespaceImport: false,
            line: nodeLine(clause),
          });
        }
      }
    }
  });

  return imports;
}

async function extractExports(content: string): Promise<RawExport[]> {
  const { parser } = await getTreeSitterRuntime("tree-sitter-php.wasm");
  const tree = parser.parse(content);
  const exports: RawExport[] = [];

  const DECL_TYPES = new Set([
    "function_definition",
    "class_declaration",
    "interface_declaration",
    "trait_declaration",
    "enum_declaration",
  ]);

  walk(tree.rootNode, (node) => {
    if (!DECL_TYPES.has(node.type)) return;
    const name = node.childForFieldName("name");
    if (!name) return;
    exports.push({ name: name.text, kind: "named", line: nodeLine(name) });
  });

  return exports;
}

export const parsePhp: LanguageParser = {
  supportedLanguages: ["php"],
  extensions: [".php"],

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