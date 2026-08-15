// Copyright 2026 ARCLUX
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Entry point for the semantic-diff pipeline (blueprint: text -> symbol ->
// AST -> dependency -> impact -> architectural). AstDiff is intentionally
// NOT auto-wired here: it needs per-file before/after content, and (like
// architecturalDiff.ts) this repo does not yet check out git refs into a
// second working tree. Call computeAstDiff separately per-file when you
// have both contents available (working tree + git show, stash, etc).

import type { Repository } from "../repository/Repository";
import { getChangedFiles } from "../diff/gitDiff";
import { computeDependencyDiff, type DependencyDiffResult } from "./DependencyDiff";
import { computeSymbolDiff, type SymbolDiffResult } from "./SymbolDiff";
import { renderSemanticDiff } from "./DiffRenderer";

export interface SemanticDiffOptions {
  repository: Repository;
  repoPath: string;
  refA: string;
  refB: string;
  /** Optional second Repository snapshot (indexed at refB) for symbol-level diffing. Skipped if omitted. */
  repositoryAfter?: Repository;
}

export interface SemanticDiffResult {
  changedFiles: string[];
  dependencyDiff: DependencyDiffResult;
  symbolDiff?: SymbolDiffResult;
  rendered: string;
}

export function computeSemanticDiff(options: SemanticDiffOptions): SemanticDiffResult {
  const changed = getChangedFiles(options.repoPath, options.refA, options.refB);
  const dependencyDiff = computeDependencyDiff(options.repository, options.repoPath, options.refA, options.refB);

  const symbolDiff = options.repositoryAfter
    ? computeSymbolDiff(options.repository, options.repositoryAfter)
    : undefined;

  const rendered = renderSemanticDiff({ symbolDiff, dependencyDiff });

  return {
    changedFiles: changed.map((c) => c.path),
    dependencyDiff,
    symbolDiff,
    rendered,
  };
}
