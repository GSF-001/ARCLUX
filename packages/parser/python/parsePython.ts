// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { createRequire } from "node:module";
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
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
      // nodeRequire.resolve() (and bare require.resolve()) returns a path
      // relative to the webpack bundle location (not a real filesystem
      // path) when running inside Next.js's webpack runtime -- confirmed
      // via debug logging. This has regressed multiple times (see
      // progres/bugs.md, 2026-08-10 entries) because someone re-adds a
      // require.resolve() call here during a later cleanup pass. DO NOT
      // call require.resolve() or nodeRequire.resolve() anywhere in this
      // function, for any file, including package.json.
      //
      // process.cwd() alone isn't reliable either -- it depends on WHERE
      // the dev server was started from (repo root vs apps/web), and
      // pnpm hoists tree-sitter-wasms to the monorepo root's node_modules,
      // not apps/web's. So walk upward from process.cwd() (same algorithm
      // Node's own module resolution uses) until node_modules/tree-sitter-wasms
      // is found, instead of assuming a fixed relative depth.
      function findWasmPath(): string {
        let dir = process.cwd();
        for (let i = 0; i < 10; i++) {
          const candidate = path.join(
            dir,
            "node_modules",
            "tree-sitter-wasms",
            "out",
            "tree-sitter-python.wasm"
          );
          if (existsSync(candidate)) return candidate;
          const parent = path.dirname(dir);
          if (parent === dir) break; // reached filesystem root
          dir = parent;
        }
        throw new Error(
          "Could not find tree-sitter-wasms/out/tree-sitter-python.wasm by walking up from " +
            process.cwd()
        );
      }
      const wasmPath = findWasmPath();
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
      let node = root.namedChildren[i];
      if (!node) continue;

      // Decorated class/function (e.g. @dataclass, @app.route) is wrapped
      // in a decorated_definition node -- the actual class_definition /
      // function_definition sits as its child, not as a sibling at root
      // level. Without unwrapping this, every decorated top-level
      // definition is silently skipped (root export count seen as 0 on
      // files that are mostly @dataclass classes).
      if (node.type === "decorated_definition") {
        node = node.childForFieldName("definition") ?? node;
      }

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
