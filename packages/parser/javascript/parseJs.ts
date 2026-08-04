// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import ts from "typescript";
import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile } from "../../shared/types";
import { extractImportsJs, extractExportsJs } from "./extractJs";

export const parseJs: LanguageParser = {
  supportedLanguages: ["javascript"],
  extensions: [".js", ".mjs", ".cjs"],

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
      return { file, imports: [], exports: [], warnings };
    }
    return {
      file,
      imports: extractImportsJs(sourceFile),
      exports: extractExportsJs(sourceFile),
      warnings,
    };
  },
};
