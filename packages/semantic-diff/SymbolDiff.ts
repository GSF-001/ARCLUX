// Copyright 2026 ARCLUX
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Wraps packages/language/SymbolEngine.ts (existing, issue #348). Does not
// reimplement symbol resolution — just diffs two SymbolEngine snapshots.

import { SymbolEngine, type SymbolInfo } from "../language/SymbolEngine";
import type { Repository } from "../repository/Repository";

export interface SymbolMove {
  name: string;
  from: string;
  to: string;
}

export interface SymbolDiffResult {
  added: SymbolInfo[];
  removed: SymbolInfo[];
  moved: SymbolMove[];
}

const engine = new SymbolEngine();

function symbolKey(s: SymbolInfo): string {
  return `${s.moduleId}::${s.name}`;
}

export function computeSymbolDiff(repoBefore: Repository, repoAfter: Repository): SymbolDiffResult {
  const before = engine.getSymbols(repoBefore);
  const after = engine.getSymbols(repoAfter);

  const beforeMap = new Map(before.map((s) => [symbolKey(s), s]));
  const afterMap = new Map(after.map((s) => [symbolKey(s), s]));

  const added = after.filter((s) => !beforeMap.has(symbolKey(s)));
  const removed = before.filter((s) => !afterMap.has(symbolKey(s)));

  const moved: SymbolMove[] = [];
  for (const rem of removed) {
    const match = added.find((a) => a.name === rem.name);
    if (match) moved.push({ name: rem.name, from: rem.moduleId, to: match.moduleId });
  }

  return { added, removed, moved };
}
