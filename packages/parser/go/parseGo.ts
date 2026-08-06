// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";
import { posix } from "node:path";

// Regex/line-based, not a full Go grammar (no tree-sitter-go grammar wired up
// yet, unlike Python — see PROGRES.md gotchas for why that's non-trivial to
// add). Handles the common cases: single-line imports, parenthesized import
// blocks, and top-level func/type/var/const declarations. Does NOT handle
// multi-line generic type params or declarations split across lines in
// unusual ways.
//
// IMPORTANT LIMITATION: Go has no relative-import syntax between files in the
// same package — all .go files in one directory implicitly share scope, so a
// function in cyclic_a.go can call one in cyclic_b.go with zero import
// statements (see playground/go-demo). This parser only extracts what's
// actually written, so same-package cross-file calls will NOT show up as
// graph edges via resolvePath.ts today. That requires a separate
// "same-package implicit dependency" resolution pass, not yet built — same
// class of gap as resolveRoutes.ts being empty for Next.js route awareness.

function stripLineComment(line: string): string {
  const idx = line.indexOf("//");
  return idx === -1 ? line : line.slice(0, idx);
}

function makeImport(source: string, line: number): RawImport {
  return {
    source,
    kind: "static",
    namedImports: [],
    hasDefaultImport: false,
    hasNamespaceImport: false,
    line,
  };
}

function extractImports(content: string): RawImport[] {
  const imports: RawImport[] = [];
  const lines = content.split("\n");
  let inBlock = false;
  let blockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComment(lines[i]).trim();
    if (!line) continue;

    if (!inBlock) {
      if (/^import\s*\(\s*$/.test(line)) {
        inBlock = true;
        blockStartLine = i + 1;
        continue;
      }

      const singleMatch = line.match(/^import\s+(?:(_|\.|\w+)\s+)?"([^"]+)"/);
      if (singleMatch) {
        imports.push(makeImport(singleMatch[2], i + 1));
      }
      continue;
    }

    if (line === ")") {
      inBlock = false;
      continue;
    }

    const entryMatch = line.match(/^(?:(_|\.|\w+)\s+)?"([^"]+)"/);
    if (entryMatch) {
      imports.push(makeImport(entryMatch[2], blockStartLine));
    }
  }

  return imports;
}

// Go has no `export` keyword — an identifier is exported iff its first letter
// is uppercase. This applies to func, type, var, and const declarations.
function extractExports(content: string): RawExport[] {
  const exports: RawExport[] = [];
  const lines = content.split("\n");

  const funcPattern = /^func\s+(?:\([^)]*\)\s+)?([A-Z]\w*)\s*[[(]/;
  const typePattern = /^type\s+([A-Z]\w*)\b/;
  const varConstPattern = /^(?:var|const)\s+([A-Z]\w*)\b/;
  const varConstBlockEntryPattern = /^([A-Z]\w*)\b/;

  let inVarConstBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComment(lines[i]).trim();
    if (!line) continue;

    if (inVarConstBlock) {
      if (line === ")") {
        inVarConstBlock = false;
        continue;
      }
      const entryMatch = line.match(varConstBlockEntryPattern);
      if (entryMatch) {
        exports.push({ name: entryMatch[1], kind: "named", line: i + 1 });
      }
      continue;
    }

    if (/^(?:var|const)\s*\(\s*$/.test(line)) {
      inVarConstBlock = true;
      continue;
    }

    const funcMatch = line.match(funcPattern);
    if (funcMatch) {
      exports.push({ name: funcMatch[1], kind: "named", line: i + 1 });
      continue;
    }

    const typeMatch = line.match(typePattern);
    if (typeMatch) {
      exports.push({ name: typeMatch[1], kind: "named", line: i + 1 });
      continue;
    }

    const varConstMatch = line.match(varConstPattern);
    if (varConstMatch) {
      exports.push({ name: varConstMatch[1], kind: "named", line: i + 1 });
    }
  }

  return exports;
}

export const parseGo: LanguageParser = {
  supportedLanguages: ["go"],
  extensions: [".go"],

  async parse(file: FileInfo, content: string): Promise<ParsedFile> {
    const warnings: string[] = [];
    let imports: RawImport[] = [];
    let exportsList: RawExport[] = [];

    try {
      imports = extractImports(content);
    } catch (err) {
      warnings.push(`Import extraction failed: ${(err as Error).message}`);
    }

    try {
      exportsList = extractExports(content);
    } catch (err) {
      warnings.push(`Export extraction failed: ${(err as Error).message}`);
    }

    return { file, imports, exports: exportsList, warnings, scopeId: posix.dirname(file.relativePath) };
  },
};
