/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { FileInfo, ParsedFile, SupportedLanguage } from "../shared/types";
import type { Repository } from "../repository/Repository";
import { SyntaxEngine } from "./SyntaxEngine";
import { SymbolEngine, type SymbolInfo } from "./SymbolEngine";

// The language-intelligence entry point (issue #348): combines the syntax
// layer (per-file parsing via packages/parser/*) with the symbol layer
// (whole-repository symbol resolution) behind one facade. Consumers
// (editor context, semantic-diff pipeline) use this instead of reaching
// into SyntaxEngine/SymbolEngine individually.

export interface LanguageServiceOptions {
  /** Repository to resolve symbols against. Optional for syntax-only use. */
  repository?: Repository;
}

export class LanguageService {
  readonly syntax = new SyntaxEngine();
  readonly symbols = new SymbolEngine();
  private readonly repository?: Repository;

  constructor(options: LanguageServiceOptions = {}) {
    this.repository = options.repository;
  }

  /** Parse a single file (throws UNSUPPORTED_LANGUAGE for unknown extensions). */
  parseFile(file: FileInfo, content: string): Promise<ParsedFile> {
    return this.syntax.parseFile(file, content);
  }

  /** Language for an extension (no parsing). */
  language(extension: string): SupportedLanguage {
    return this.syntax.language(extension);
  }

  /** All exported symbols in the repository (empty when no repository is set). */
  getSymbols(): SymbolInfo[] {
    return this.repository ? this.symbols.getSymbols(this.repository) : [];
  }

  /** Symbols with a given name (empty when no repository is set). */
  findSymbol(name: string): SymbolInfo[] {
    return this.repository ? this.symbols.findByName(this.repository, name) : [];
  }

  /** Symbols exported by one module (empty when no repository is set). */
  symbolsForModule(moduleId: string): SymbolInfo[] {
    return this.repository ? this.symbols.forModule(this.repository, moduleId) : [];
  }

  /** Consumers (importers + callers) of a module (empty when no repository is set). */
  consumers(moduleId: string): string[] {
    return this.repository ? this.symbols.consumers(this.repository, moduleId) : [];
  }
}
