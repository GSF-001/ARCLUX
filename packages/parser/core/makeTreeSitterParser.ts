// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Factory for tree-sitter-backed language parsers. A language is just a
// wasm grammar + two extraction functions (imports, exports) + the
// supported-language metadata. The factory wires them into the
// LanguageParser contract, so adding a language is ~40 lines of config,
// never a copy-paste of the parse/walk machinery.

import type { LanguageParser } from "./ParserInterface";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";
import { getTreeSitterRuntime, type TSNode } from "./treeSitterLoader";

export interface TreeSitterLanguageConfig {
  /** wasm filename inside tree-sitter-wasms/out, e.g. "tree-sitter-swift.wasm" */
  wasmFile: string;
  supportedLanguage: string;
  extensions: string[];
  extractImports(root: TSNode, parser: unknown): RawImport[];
  extractExports(root: TSNode, parser: unknown): RawExport[];
}

export function makeTreeSitterParser(config: TreeSitterLanguageConfig): LanguageParser {
  const runtimePromise = getTreeSitterRuntime(config.wasmFile);

  return {
    supportedLanguages: [config.supportedLanguage],
    extensions: config.extensions,

    async parse(file: FileInfo, content: string): Promise<ParsedFile> {
      const { parser } = await runtimePromise;
      const tree = parser.parse(content);
      const root: TSNode = tree.rootNode;

      let imports: RawImport[] = [];
      let exportsList: RawExport[] = [];
      const warnings: string[] = [];

      try {
        imports = config.extractImports(root, parser);
      } catch (err) {
        warnings.push(`Import extraction failed: ${(err as Error).message}`);
      }
      try {
        exportsList = config.extractExports(root, parser);
      } catch (err) {
        warnings.push(`Export extraction failed: ${(err as Error).message}`);
      }

      // @interface + @implementation (objc), class + struct re-declarations
      // etc. can emit the same symbol twice; keep the first occurrence.
      const seen = new Set<string>();
      exportsList = exportsList.filter((exp) => {
        if (seen.has(exp.name)) return false;
        seen.add(exp.name);
        return true;
      });

      return {
        file,
        imports,
        exports: exportsList,
        warnings,
      };
    },
  };
}

/** First named child of the given types under `node` (shallow scan). */
export function findChild(node: TSNode | null, types: string[]): TSNode | null {
  if (!node) return null;
  for (const child of node.namedChildren) {
    if (child && types.includes(child.type)) return child;
  }
  return null;
}

/** All children matching the given types (shallow scan). */
export function childrenOfType(node: TSNode | null, types: string[]): TSNode[] {
  if (!node) return [];
  const out: TSNode[] = [];
  for (const child of node.namedChildren) {
    if (child && types.includes(child.type)) out.push(child);
  }
  return out;
}