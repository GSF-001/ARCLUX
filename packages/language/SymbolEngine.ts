/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { Repository } from "../repository/Repository";
import type { ModuleInfo, RawExport } from "../shared/types";

// Symbol-level resolution over an already-indexed Repository (issue #348).
// Every export in every module is a symbol; for each one we report where it
// is declared (module + line), which modules import that module, and which
// modules call its exported functions (calledBy). Consumers can jump
// symbol -> declaration -> importers/callers without re-indexing.

export interface SymbolInfo {
  name: string;
  /** Module that declares this symbol. */
  moduleId: string;
  /** Module's file path. */
  filePath: string;
  /** Declaration line (1-indexed) from RawExport, or null for unknown. */
  line: number | null;
  /** Whether it's a default, named, or re-export. */
  kind: RawExport["kind"];
  /** For re-exports: the module being re-exported from, if internal. */
  reExportSource?: string;
  /** Module ids that import the declaring module. */
  importedBy: string[];
  /** Module ids that call this symbol's module exports (approximate, JS-family only). */
  calledBy: string[];
}

export class SymbolEngine {
  /** All exported symbols across the repository. */
  getSymbols(repository: Repository): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    for (const module of repository.getAllModules()) {
      for (const exportItem of module.exports) {
        symbols.push(this.describe(repository, module, exportItem));
      }
    }
    return symbols;
  }

  /** All symbols with a given name (a name can be exported by many modules). */
  findByName(repository: Repository, name: string): SymbolInfo[] {
    return this.getSymbols(repository).filter((symbol) => symbol.name === name);
  }

  /** Symbols exported by one module. */
  forModule(repository: Repository, moduleId: string): SymbolInfo[] {
    const module = repository.getModule(moduleId);
    if (!module) return [];
    return module.exports.map((exportItem) => this.describe(repository, module, exportItem));
  }

  /** Consumers (importers + callers) of a module's exports. */
  consumers(repository: Repository, moduleId: string): string[] {
    const module = repository.getModule(moduleId);
    if (!module) return [];
    return [...new Set([...module.importedBy, ...module.calledBy])];
  }

  private describe(repository: Repository, module: ModuleInfo, exportItem: RawExport): SymbolInfo {
    const reExportSource = exportItem.reExportSource
      ? module.resolvedReExports[exportItem.name] ?? exportItem.reExportSource
      : undefined;

    const direct = [...module.importedBy];
    return {
      name: exportItem.name,
      moduleId: module.id,
      filePath: module.file.relativePath,
      line: exportItem.line,
      kind: exportItem.kind,
      reExportSource,
      importedBy: direct,
      calledBy: [...module.calledBy],
    };
  }
}
