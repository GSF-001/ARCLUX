// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Vue parser: extracts <script> blocks and reuses the proven JS
// import/export extractors (TypeScript Compiler API) on the script text.
// No TSX markup handled — options/composition API both just produce JS.

import ts from "typescript";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";
import { getTreeSitterRuntime } from "../core/treeSitterLoader";
import { extractImportsJs, extractExportsJs } from "../javascript/extractJs";

function extractScripts(content: string): string[] {
  const scripts: string[] = [];
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    scripts.push(match[1]);
  }
  return scripts;
}

export const parseVue = {
  supportedLanguages: ["vue"],
  extensions: [".vue"],

  async parse(file: FileInfo, content: string): Promise<ParsedFile> {
    const warnings: string[] = [];
    const imports: RawImport[] = [];
    const exports: RawExport[] = [];

    const scripts = extractScripts(content);
    if (scripts.length === 0) {
      warnings.push("No <script> block found");
      return { file, imports, exports, warnings };
    }

    try {
      const { parser } = await getTreeSitterRuntime("tree-sitter-vue.wasm");
      parser.parse(content); // validates the file parses as vue at all
    } catch (err) {
      warnings.push(`Failed to parse: ${(err as Error).message}`);
      return { file, imports, exports, warnings };
    }

    for (const script of scripts) {
      const sourceFile = ts.createSourceFile(
        file.relativePath || "component.vue",
        script,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS
      );
      try {
        imports.push(...extractImportsJs(sourceFile));
        exports.push(...extractExportsJs(sourceFile));
        // `export default { ... }` (the universal Vue SFC shape) is an
        // anonymous object literal — extractExportsJs skips it. Emit the
        // conventional "default" export so graph consumers see it.
        if (/export\s+default\s*\{/.test(script)) {
          exports.push({ name: "default", kind: "default", line: 1 });
        }
      } catch (err) {
        warnings.push(`Script extraction failed: ${(err as Error).message}`);
      }
    }

    return { file, imports, exports, warnings };
  },
};