// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { LanguageParser } from "../core/ParserInterface";
import { getTreeSitterRuntime, type TreeSitterRuntime } from "../core/treeSitterLoader";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";

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

/**
 * Loads the tree-sitter runtime + Python grammar exactly once, then reuses
 * the same Parser instance everywhere. Backed by the shared
 * getTreeSitterRuntime() from treeSitterLoader, which resolves the wasm
 * from the package location (`import.meta.url`) in addition to cwd -- so
 * the Python grammar is found even when the CLI runs with cwd = the
 * analyzed repository (fixes #613).
 */
export function getPythonRuntime(): Promise<TreeSitterRuntime> {
  return getTreeSitterRuntime("tree-sitter-python.wasm");
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

  /**
   * Imports under `if TYPE_CHECKING:` (or `if typing.TYPE_CHECKING:`) are
   * type-only — they exist for the type checker, not the runtime. They are
   * MARKED with kind "type-only" (mirroring parseTs.ts's importClause.isTypeOnly)
   * and stay in the graph; the cycle detector excludes them from runtime-cycle
   * reporting (dependency-cruiser's `no-circular-at-runtime` pattern,
   * viaOnly.dependencyTypesNot ["type-only"]). Decision #458, Variant C.
   */
  function isTypeCheckingGuard(node: TSNode): boolean {
    if (node.type !== "if_statement") return false;
    const condition = node.childForFieldName("condition");
    if (!condition) return false;
    return condition.text === "TYPE_CHECKING" || condition.text === "typing.TYPE_CHECKING";
  }

  function visit(node: TSNode | null, typeOnly = false) {
    if (!node) return;

    const inTypeOnly = typeOnly || isTypeCheckingGuard(node);

    if (node.type === "import_statement") {
      for (let i = 0; i < node.namedChildren.length; i++) {
        const child = node.namedChildren[i];
        if (!child) continue;

        if (child.type === "dotted_name") {
          imports.push({
            source: dottedNameToString(child),
            kind: inTypeOnly ? "type-only" : "static",
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
              kind: inTypeOnly ? "type-only" : "static",
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
        kind: inTypeOnly ? "type-only" : "static",
        namedImports: isWildcard ? ["*"] : namedImports,
        hasDefaultImport: false,
        hasNamespaceImport: false,
        line: getLine(node),
      });
    }

    for (let i = 0; i < node.childCount; i++) {
      visit(node.child(i), inTypeOnly);
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
