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
import { SymbolEngine, type SymbolInfo } from "./SymbolEngine";

// Repository-aware auto-completion (issue #348). Given a module and a
// partial identifier, suggest exported symbols from the repository. Two
// sources: (1) symbols exported by modules this file already imports, and
// (2) every exported symbol whose name starts with the prefix. This is the
// symbol-graph completion — identifier-position precision (is the cursor
// really in an identifier position?) is the editor's job (packages/editor),
// not this engine's.

export interface CompletionItem {
  name: string;
  moduleId: string;
  filePath: string;
  line: number | null;
  kind: SymbolInfo["kind"];
  /** Whether the symbol comes from a module this file already imports. */
  alreadyImported: boolean;
}

export class CompletionEngine {
  private readonly symbols = new SymbolEngine();

  constructor(private readonly repository: Repository) {}

  /**
   * Completion candidates for a prefix in a module.
   * @param moduleId the module being edited (for the "already imported" boost)
   * @param prefix   the partial identifier, e.g. "useSt"
   */
  complete(moduleId: string, prefix: string): CompletionItem[] {
    const module = this.repository.getModule(moduleId);
    const importedModuleIds = new Set(module?.imports ?? []);

    const all = this.symbols.getSymbols(this.repository);
    const matches = all.filter((symbol) => symbol.name.startsWith(prefix));

    // Dedupe by name — a name exported by several modules is one suggestion
    // (prefer the symbol from an already-imported module over other definitions).
    const byName = new Map<string, { symbol: SymbolInfo; alreadyImported: boolean }>();
    for (const symbol of matches) {
      const alreadyImported = importedModuleIds.has(symbol.moduleId);
      const existing = byName.get(symbol.name);
      if (!existing || (alreadyImported && !existing.alreadyImported)) {
        byName.set(symbol.name, { symbol, alreadyImported });
      }
    }

    return [...byName.values()].map(({ symbol, alreadyImported }) => ({
      name: symbol.name,
      moduleId: symbol.moduleId,
      filePath: symbol.filePath,
      line: symbol.line,
      kind: symbol.kind,
      alreadyImported,
    }));
  }
}
