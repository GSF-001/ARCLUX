// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { createRequire } from "node:module";
import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";

// web-tree-sitter ships no .d.ts and cannot be module-augmented from a plain
// .ts file (its main entry resolves to an untyped .js — see PROGRES.md
// gotchas). We deliberately load it as untyped and keep our own type safety
// entirely in the TSNode interface below.
// Deliberately NOT named "require" -- Webpack's static analyzer matches on
// the literal identifier "require" regardless of whether it is a real
// CommonJS require or (as here) a variable from createRequire(), and tries
// to statically bundle whatever it's called with. That breaks
// serverExternalPackages, which only takes effect at module-resolution
// time, after this static analysis already failed on the .wasm file below.
// Renaming the identifier avoids triggering that analysis entirely.
const nodeRequire = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TreeSitter: any = nodeRequire("web-tree-sitter");
const { Parser, Language } = TreeSitter;

// Minimal structural type for the parts of a web-tree-sitter node we use.
// Avoids depending on internal/unstable type exports from the package.
export interface TSNode {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  childCount: number;
  child(index: number): TSNode | null;
  childForFieldName(name: string): TSNode | null;
  namedChildren: (TSNode | null)[];
}

export interface PythonRuntime {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parser: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  language: any;
}

let runtimePromise: Promise<PythonRuntime> | null = null;

/**
 * Loads the tree-sitter runtime + Python grammar exactly once, then reuses
 * the same Parser instance everywhere. Loading the WASM module per-call
 * would be very slow across a full repository scan (parsePython.ts below)
 * or when highlighting many files (highlightPython.ts, which imports this
 * same function so the WASM module is only ever loaded once total).
 */
export function getPythonRuntime(): Promise<PythonRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await Parser.init();
      const parser = new Parser();
      const wasmPath = nodeRequire.resolve("tree-sitter-wasms/out/tree-sitter-python.wasm");
      const language = await Language.load(wasmPath);
      parser.setLanguage(language);
      return { parser, language };
    })();
  }
  return runtimePromise;
}

function getLine(node: TSNode): number {
  return node.startPosition.row + 1;
}

/** Joins a dotted_name node (e.g. "a" "." "b" "." "c") into "a.b.c" */
function dottedNameToString(node: TSNode): string {
  return node.text;
}

function extractImports(root: TSNode, warnings: string[]): RawImport[] {
  const imports: RawImport[] = [];

  function visit(node: TSNode | null) {
    if (!node) return;

    if (node.type === "import_statement") {
      for (let i = 0; i < node.namedChildren.length; i++) {
        const child = node.namedChildren[i];
        if (!child) continue;

        if (child.type === "dotted_name") {
          imports.push({
            source: dottedNameToString(child),
            kind: "static",
            namedImports: [],
            hasDefaultImport: false,
            hasNamespaceImport: false,
            line: getLine(node),
          });
        } else if (child.type === "aliased_import") {
          const name = child.childForFieldName("name");
          if (name) {
            imports.push({
              source: dottedNameToString(name),
              kind: "static",
              namedImports: [],
              hasDefaultImport: false,
              hasNamespaceImport: false,
              line: getLine(node),
            });
          }
        }
      }
    }

    if (node.type === "import_from_statement") {
      const moduleNode = node.childForFieldName("module_name");
      const source = moduleNode ? dottedNameToString(moduleNode) : ".";

      const namedImports: string[] = [];
      let isWildcard = false;

      for (let i = 0; i < node.namedChildren.length; i++) {
        const child = node.namedChildren[i];
        if (!child) continue;

        if (child.type === "wildcard_import") {
          isWildcard = true;
        } else if (child.type === "aliased_import") {
          const name = child.childForFieldName("name");
          if (name) namedImports.push(name.text);
        } else if (child.type === "dotted_name" && child !== moduleNode) {
          namedImports.push(child.text);
        }
      }

      imports.push({
        source,
        kind: "static",
        namedImports: isWildcard ? ["*"] : namedImports,
        hasDefaultImport: false,
        hasNamespaceImport: false,
        line: getLine(node),
      });
    }

    for (let i = 0; i < node.childCount; i++) {
      visit(node.child(i));
    }
  }

  try {
    visit(root);
  } catch (err) {
    warnings.push(`Import extraction failed: ${(err as Error).message}`);
  }

  return imports;
}

function extractExports(root: TSNode, warnings: string[]): RawExport[] {
  const exports: RawExport[] = [];

  try {
    for (let i = 0; i < root.namedChildren.length; i++) {
      const node = root.namedChildren[i];
      if (!node) continue;

      if (node.type === "function_definition" || node.type === "class_definition") {
        const name = node.childForFieldName("name");
        if (name) {
          exports.push({
            name: name.text,
            kind: "named",
            line: getLine(node),
          });
        }
      }
    }
  } catch (err) {
    warnings.push(`Export extraction failed: ${(err as Error).message}`);
  }

  return exports;
}

export const parsePython: LanguageParser = {
  supportedLanguages: ["python"],
  extensions: [".py"],

  async parse(file: FileInfo, content: string): Promise<ParsedFile> {
    const warnings: string[] = [];

    try {
      const { parser } = await getPythonRuntime();
      const tree = parser.parse(content);
      const root = tree.rootNode as unknown as TSNode;

      const imports = extractImports(root, warnings);
      const exports = extractExports(root, warnings);

      return { file, imports, exports, warnings };
    } catch (err) {
      warnings.push(`Failed to parse: ${(err as Error).message}`);
      return { file, imports: [], exports: [], warnings };
    }
  },
};
