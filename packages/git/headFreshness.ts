// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { simpleGit } from "simple-git";

/**
 * Head freshness — TypeScript port of ManSio/mscodebase-intelligence's
 * freshness contract (test_symbol_freshness.py, issues #21/#22 fix line).
 *
 * Problem it solves: an analysis result outlives the tree it was built
 * from (daemon cache, db AnalysisStore, an agent holding an old snapshot).
 * Consuming it as current is a stale-anchor bug — ManSio #22's class
 * (VERIFIED stamped on a deleted symbol because its FILE still existed).
 *
 * Contract (mirrors ManSio's 7 freshness cases exactly):
 * - build head == current HEAD **and** tree clean → FRESH.
 * - HEAD moved, tree dirty, build head unknown (legacy), or not a git
 *   repo at all → never FRESH: STALE when we can tell it moved,
 *   INCONCLUSIVE when we cannot tell (fail-closed: unverifiable analysis
 *   is never presented as fresh).
 *
 * Wiring: engine pipeline stamps RepositoryMeta.buildHead at analysis
 * time (getHeadState); any reader holding a stamped result calls
 * evaluateFreshness against a fresh getHeadState before trusting it.
 * Records without a stamp (legacy) are INCONCLUSIVE, never FRESH.
 */

/** Git state captured at analysis-build time (or read time). */
export interface HeadState {
  /** False for non-git directories — commit/dirty are meaningless there. */
  isRepo: boolean;
  /** Full HEAD sha, or null when unknown (non-repo, fresh clone without commits). */
  commit: string | null;
  /** Uncommitted changes present (staged or unstaged, incl. untracked). */
  dirty: boolean;
}

export type Freshness = "FRESH" | "STALE" | "INCONCLUSIVE";

/**
 * Capture the current head state of rootPath. Never throws: non-git
 * directories and git failures yield { isRepo: false, ... } so callers
 * degrade to INCONCLUSIVE instead of crashing analysis.
 */
export async function getHeadState(rootPath: string): Promise<HeadState> {
  try {
    const git = simpleGit(rootPath);
    if (!(await git.checkIsRepo())) {
      return { isRepo: false, commit: null, dirty: false };
    }
    let commit: string | null = null;
    try {
      const raw = await git.revparse(["HEAD"]);
      commit = raw.trim() || null;
    } catch {
      commit = null; // repo without commits yet — known state, not an error
    }
    let dirty = false;
    try {
      const status = await git.status();
      dirty = !status.isClean();
    } catch {
      dirty = false;
    }
    return { isRepo: true, commit, dirty };
  } catch {
    return { isRepo: false, commit: null, dirty: false };
  }
}

/**
 * buildHead: the stamp recorded when the analysis was built (null/absent
 * = legacy record, pre-stamp). current: a fresh getHeadState of the same
 * rootPath, taken at read time.
 */
export function evaluateFreshness(
  buildHead: HeadState | null | undefined,
  current: HeadState,
): Freshness {
  // Legacy record or non-git tree: we cannot tell → fail closed.
  if (!buildHead || !buildHead.isRepo || !current.isRepo) return "INCONCLUSIVE";
  if (!buildHead.commit || !current.commit) return "INCONCLUSIVE";
  // Dirty at either end means the tree is not exactly what was analyzed.
  if (buildHead.dirty || current.dirty) return "STALE";
  return buildHead.commit === current.commit ? "FRESH" : "STALE";
}

/**
 * Human-facing report over evaluateFreshness: same verdict, plus the
 * detail a CLI needs so STALE never scares without explaining. In
 * particular a just-built analysis of a dirty tree reports STALE with
 * the working-tree explanation (fail-closed: dirty was never anchored
 * to a commit), not a bare alarm.
 */
export interface FreshnessReport {
  verdict: Freshness;
  /** Short (7-char) build commit, or null when unknown. */
  shortCommit: string | null;
  detail: string;
}

export function reportFreshness(
  buildHead: HeadState | null | undefined,
  current: HeadState,
): FreshnessReport {
  const verdict = evaluateFreshness(buildHead, current);
  const shortCommit = buildHead?.commit?.slice(0, 7) ?? null;
  if (verdict === "FRESH") {
    return { verdict, shortCommit, detail: `HEAD ${shortCommit} (clean)` };
  }
  if (!buildHead || !buildHead.isRepo || !current.isRepo || !buildHead.commit || !current.commit) {
    return { verdict, shortCommit, detail: "no git anchor — legacy result or non-git tree; treat as snapshot, re-run to anchor" };
  }
  if (buildHead.commit !== current.commit) {
    return {
      verdict,
      shortCommit,
      detail: `tree moved since analysis (built at ${shortCommit}, now at ${current.commit.slice(0, 7)}) — re-run analysis`,
    };
  }
  return {
    verdict,
    shortCommit,
    detail: "uncommitted changes present — results track the working tree, re-run after commit for an anchored result",
  };
}
