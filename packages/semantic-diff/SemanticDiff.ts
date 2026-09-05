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
  /**
   * Output detail (BUG-3): "summary" (default) returns file lists +
   * per-module impact COUNTS + symbol counts — no per-file affected trees,
   * no full SymbolInfo arrays. "full" returns the legacy complete shape.
   * The full shape bloated MCP responses past truncation (132KB on a
   * 16-module split) and ate agent context; default summary, opt-in full.
   */
  detail?: "summary" | "full";
}

export interface SemanticDiffSummaryCounts {
  affectedFiles: number;
}

export interface SemanticDiffResult {
  /** Which detail mode produced this result. */
  mode: "summary" | "full";
  changedFiles: string[];
  dependencyDiff: DependencyDiffResult;
  symbolDiff?: SymbolDiffResult;
  /** Summary-only projections (absent in full mode). */
  impactCounts?: Record<string, SemanticDiffSummaryCounts>;
  symbolCounts?: { added: number; removed: number; moved: number };
  rendered: string;
}

export function computeSemanticDiff(options: SemanticDiffOptions): SemanticDiffResult {
  const mode = options.detail ?? "summary";
  const changed = getChangedFiles(options.repoPath, options.refA, options.refB);
  const dependencyDiff = computeDependencyDiff(options.repository, options.repoPath, options.refA, options.refB);

  const symbolDiff = options.repositoryAfter
    ? computeSymbolDiff(options.repository, options.repositoryAfter)
    : undefined;

  const rendered = renderSemanticDiff({ symbolDiff, dependencyDiff });

  if (mode === "full") {
    return { mode, changedFiles: changed.map((c) => c.path), dependencyDiff, symbolDiff, rendered };
  }

  // Summary: counts + moved list only. impactByModule trees and full
  // SymbolInfo arrays stay server-side (they caused the 132KB bloat).
  const impactCounts: Record<string, SemanticDiffSummaryCounts> = {};
  for (const [mod, impact] of Object.entries(dependencyDiff.impactByModule)) {
    impactCounts[mod] = { affectedFiles: impact.affectedFiles.length };
  }
  return {
    mode,
    changedFiles: changed.map((c) => c.path),
    dependencyDiff: { ...dependencyDiff, impactByModule: {} },
    symbolDiff: symbolDiff
      ? { added: [], removed: [], moved: symbolDiff.moved }
      : undefined,
    impactCounts,
    symbolCounts: symbolDiff
      ? { added: symbolDiff.added.length, removed: symbolDiff.removed.length, moved: symbolDiff.moved.length }
      : undefined,
    rendered,
  };
}
