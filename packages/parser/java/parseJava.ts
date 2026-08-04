// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile, RawImport, RawExport } from "../../shared/types";

// Regex/line-based, not a full Java grammar. Handles import statements
// (including `static` and wildcard `.*` imports) and public-modifier
// class/interface/enum/record, method, and field declarations. Does NOT
// handle multi-line method signatures, annotations spread across lines,
// or generics with nested angle brackets containing commas.
//
// IMPORTANT LIMITATION: like Go, Java classes in the same package don't need
// an import statement to reference each other (see playground/java-demo —
// Main.java calls Service/Models/Utils with zero imports). This parser only
// extracts what's actually written, so same-package cross-file references
// will NOT show up as graph edges via resolvePath.ts today — same gap as
// documented in parseGo.ts.

function stripLineComment(line: string): string {
  const idx = line.indexOf("//");
  return idx === -1 ? line : line.slice(0, idx);
}

function extractImports(content: string): RawImport[] {
  const imports: RawImport[] = [];
  const lines = content.split("\n");
  const importPattern = /^import\s+(static\s+)?([\w.]+(?:\.\*)?)\s*;/;

  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComment(lines[i]).trim();
    const match = line.match(importPattern);
    if (!match) continue;

    const isWildcard = match[2].endsWith(".*");
    imports.push({
      source: match[2],
      kind: "static",
      namedImports: isWildcard ? ["*"] : [],
      hasDefaultImport: false,
      hasNamespaceImport: isWildcard,
      line: i + 1,
    });
  }

  return imports;
}

// Only `public` members are treated as exports — `protected`/package-private
// are visible within the package (relevant given the same-package limitation
// above) but not truly "exported" in the cross-module sense this codebase
// otherwise means by RawExport.
function extractExports(content: string): RawExport[] {
  const exports: RawExport[] = [];
  const lines = content.split("\n");

  const classPattern =
    /^public\s+(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:class|interface|enum|record)\s+(\w+)/;
  const methodPattern = /^public\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?[\w<>[\],.]+\s+(\w+)\s*\(/;
  const fieldPattern = /^public\s+(?:static\s+)?(?:final\s+)?[\w<>[\],.]+\s+(\w+)\s*(?:=.*)?;/;

  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComment(lines[i]).trim();
    if (!line) continue;

    const classMatch = line.match(classPattern);
    if (classMatch) {
      exports.push({ name: classMatch[1], kind: "named", line: i + 1 });
      continue;
    }

    if (line.includes("(")) {
      const methodMatch = line.match(methodPattern);
      if (methodMatch) {
        exports.push({ name: methodMatch[1], kind: "named", line: i + 1 });
        continue;
      }
    }

    if (line.endsWith(";")) {
      const fieldMatch = line.match(fieldPattern);
      if (fieldMatch) {
        exports.push({ name: fieldMatch[1], kind: "named", line: i + 1 });
      }
    }
  }

  return exports;
}

export const parseJava: LanguageParser = {
  supportedLanguages: ["java"],
  extensions: [".java"],

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

    return { file, imports, exports: exportsList, warnings };
  },
};
