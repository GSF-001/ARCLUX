// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Currently identical behavior to parseJs.ts -- extractJs.ts already
// detects require()/module.exports.x/exports.x regardless of ScriptKind.
// Kept as a separate named parser (rather than folding into parseJs.ts)
// because CommonJS-specific handling (whole-object exports, the
// stop-at-first-unsafe-value scanning behavior cjs-module-lexer uses) is
// planned as follow-up work scoped to this file specifically -- see
// PROGRES.md. Do not delete this file as "duplicate of parseJs.ts" without
// checking PROGRES.md first.
import ts from "typescript";
import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile } from "../../shared/types";
import { extractImportsJs, extractExportsJs, extractCallsJs } from "./extractJs";

export const parseCommonJs: LanguageParser = {
  supportedLanguages: ["javascript"],
  extensions: [".cjs"],

  async parse(file: FileInfo, content: string): Promise<ParsedFile> {
    const warnings: string[] = [];
    let sourceFile: ts.SourceFile;
    try {
      sourceFile = ts.createSourceFile(
        file.absolutePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS
      );
    } catch (err) {
      warnings.push(`Failed to parse: ${(err as Error).message}`);
      return { file, imports: [], exports: [], calls: [], warnings };
    }
    return {
      file,
      imports: extractImportsJs(sourceFile),
      exports: extractExportsJs(sourceFile),
      calls: extractCallsJs(sourceFile),
      warnings,
    };
  },
};
