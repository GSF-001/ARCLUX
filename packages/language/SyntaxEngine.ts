/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { FileInfo, ParsedFile, RawCall, SupportedLanguage } from "../shared/types";
import { detectLanguage } from "../parser/core/LanguageDetector";
import { parserRegistry } from "../parser/core/ParserRegistry";
import { ensureParsersRegistered } from "../engine/pipeline";
import { ArcluxError } from "../shared/errors";

// Syntax-level analysis of individual files (issue #348). Wraps the
// existing packages/parser/* via the shared ParserRegistry — this layer
// exists so editor/semantic-diff consumers can parse a single file on
// demand without knowing which parser handles which extension, exactly as
// engine/pipeline.ts does for whole-repo analysis.

export interface SyntaxAnalysis {
  language: SupportedLanguage;
  imports: ParsedFile["imports"];
  exports: ParsedFile["exports"];
  calls: RawCall[];
  warnings: string[];
}

export class SyntaxEngine {
  /**
   * Parses one file's content into the shared ParsedFile shape.
   * Throws ArcluxError UNSUPPORTED_LANGUAGE when no parser is registered
   * for the file's extension (caller should check `language` first).
   */
  async parseFile(file: FileInfo, content: string): Promise<ParsedFile> {
    ensureParsersRegistered();
    const parser = parserRegistry.getParserForExtension(file.extension);
    if (!parser) {
      throw new ArcluxError({
        code: "UNSUPPORTED_LANGUAGE",
        message: `No parser registered for extension "${file.extension}"`,
      });
    }
    return parser.parse(file, content);
  }

  /** Cheap language detection from the file extension (no parsing). */
  language(extension: string): SupportedLanguage {
    return detectLanguage(extension);
  }

  /** Whether any registered parser handles this extension. */
  supports(extension: string): boolean {
    return parserRegistry.getParserForExtension(extension) !== undefined;
  }

  /** Convenience: parse and keep only the parts consumers usually need. */
  async analyze(file: FileInfo, content: string): Promise<SyntaxAnalysis> {
    const parsed = await this.parseFile(file, content);
    return {
      language: detectLanguage(file.extension),
      imports: parsed.imports,
      exports: parsed.exports,
      calls: parsed.calls ?? [],
      warnings: parsed.warnings,
    };
  }
}
