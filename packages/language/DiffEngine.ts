/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { ParsedFile } from "../shared/types";

// Symbol-level diff of two versions of a file (issue #348): the first
// stage of the semantic-diff pipeline (text → symbols → ...). Compares
// exports, imports and call sites by identity (name/source/line-agnostic
// where possible) and reports what was added/removed/kept. This is the
// "what changed at the symbol level" answer that text diff alone can't
// give (renamed export = remove+add, not a line edit).

export interface SymbolDiffResult {
  exportsAdded: string[];
  exportsRemoved: string[];
  exportsKept: string[];
  importsAdded: string[];
  importsRemoved: string[];
  importsKept: string[];
  /** Call sites present in both versions, keyed by callee name. */
  callsKept: string[];
  /** Rough change signal: 0 = no symbol-level change. */
  changeCount: number;
}

export function diffSymbols(before: ParsedFile, after: ParsedFile): SymbolDiffResult {
  const beforeExports = new Set(before.exports.map((e) => e.name));
  const afterExports = new Set(after.exports.map((e) => e.name));
  const exportsAdded = [...afterExports].filter((name) => !beforeExports.has(name)).sort();
  const exportsRemoved = [...beforeExports].filter((name) => !afterExports.has(name)).sort();
  const exportsKept = [...beforeExports].filter((name) => afterExports.has(name)).sort();

  const beforeImports = new Set(before.imports.map((i) => i.source));
  const afterImports = new Set(after.imports.map((i) => i.source));
  const importsAdded = [...afterImports].filter((source) => !beforeImports.has(source)).sort();
  const importsRemoved = [...beforeImports].filter((source) => !afterImports.has(source)).sort();
  const importsKept = [...beforeImports].filter((source) => afterImports.has(source)).sort();

  const beforeCalls = new Set((before.calls ?? []).map((c) => c.calleeName));
  const afterCalls = new Set((after.calls ?? []).map((c) => c.calleeName));
  const callsKept = [...beforeCalls].filter((name) => afterCalls.has(name)).sort();

  return {
    exportsAdded,
    exportsRemoved,
    exportsKept,
    importsAdded,
    importsRemoved,
    importsKept,
    callsKept,
    changeCount: exportsAdded.length + exportsRemoved.length + importsAdded.length + importsRemoved.length,
  };
}

/** True when the symbol surface (exports+imports) is unchanged. */
export function hasSymbolChanges(diff: SymbolDiffResult): boolean {
  return diff.changeCount > 0;
}
