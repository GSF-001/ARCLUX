// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Fuzzy match scoring algorithm adapted from pacocoursey/cmdk (MIT) —
// see src/command-score.ts in that project. Re-typed for TypeScript strict
// mode (original is untyped JS despite the .ts extension) and renamed for
// ARCLUX's naming convention; scoring logic and constants are unchanged
// from upstream since they encode tuned heuristics, not something to
// "improve" without the same empirical tuning process the original went
// through.
//
// Used by packages/search/SearchIndex.ts to rank results, and can upgrade
// GraphSearch.tsx's node-label matching (currently likely exact/substring
// match — check that file before assuming this replaces it wholesale).

const SCORE_CONTINUE_MATCH = 1;
const SCORE_SPACE_WORD_JUMP = 0.9;
const SCORE_NON_SPACE_WORD_JUMP = 0.8;
const SCORE_CHARACTER_JUMP = 0.17;
const SCORE_TRANSPOSITION = 0.1;
const PENALTY_SKIPPED = 0.999;
const PENALTY_CASE_MISMATCH = 0.9999;
const PENALTY_NOT_COMPLETE = 0.99;

const IS_GAP_REGEXP = /[\\/_+.#"@[({&]/;
const COUNT_GAPS_REGEXP = /[\\/_+.#"@[({&]/g;
const IS_SPACE_REGEXP = /[\s-]/;
const COUNT_SPACE_REGEXP = /[\s-]/g;

function fuzzyScoreInner(
  text: string,
  query: string,
  lowerText: string,
  lowerQuery: string,
  textIndex: number,
  queryIndex: number,
  memo: Record<string, number>
): number {
  if (queryIndex === query.length) {
    return textIndex === text.length ? SCORE_CONTINUE_MATCH : PENALTY_NOT_COMPLETE;
  }

  const memoKey = `${textIndex},${queryIndex}`;
  const memoized = memo[memoKey];
  if (memoized !== undefined) return memoized;

  const queryChar = lowerQuery.charAt(queryIndex);
  let index = lowerText.indexOf(queryChar, textIndex);
  let highScore = 0;

  while (index >= 0) {
    let score = fuzzyScoreInner(text, query, lowerText, lowerQuery, index + 1, queryIndex + 1, memo);

    if (score > highScore) {
      if (index === textIndex) {
        score *= SCORE_CONTINUE_MATCH;
      } else if (IS_GAP_REGEXP.test(text.charAt(index - 1))) {
        score *= SCORE_NON_SPACE_WORD_JUMP;
        const wordBreaks = text.slice(textIndex, index - 1).match(COUNT_GAPS_REGEXP);
        if (wordBreaks && textIndex > 0) {
          score *= PENALTY_SKIPPED ** wordBreaks.length;
        }
      } else if (IS_SPACE_REGEXP.test(text.charAt(index - 1))) {
        score *= SCORE_SPACE_WORD_JUMP;
        const spaceBreaks = text.slice(textIndex, index - 1).match(COUNT_SPACE_REGEXP);
        if (spaceBreaks && textIndex > 0) {
          score *= PENALTY_SKIPPED ** spaceBreaks.length;
        }
      } else {
        score *= SCORE_CHARACTER_JUMP;
        if (textIndex > 0) {
          score *= PENALTY_SKIPPED ** (index - textIndex);
        }
      }

      if (text.charAt(index) !== query.charAt(queryIndex)) {
        score *= PENALTY_CASE_MISMATCH;
      }
    }

    const isTransposition =
      (score < SCORE_TRANSPOSITION && lowerText.charAt(index - 1) === lowerQuery.charAt(queryIndex + 1)) ||
      (lowerQuery.charAt(queryIndex + 1) === lowerQuery.charAt(queryIndex) &&
        lowerText.charAt(index - 1) !== lowerQuery.charAt(queryIndex));

    if (isTransposition) {
      const transposedScore = fuzzyScoreInner(text, query, lowerText, lowerQuery, index + 1, queryIndex + 2, memo);
      if (transposedScore * SCORE_TRANSPOSITION > score) {
        score = transposedScore * SCORE_TRANSPOSITION;
      }
    }

    if (score > highScore) highScore = score;
    index = lowerText.indexOf(queryChar, index + 1);
  }

  memo[memoKey] = highScore;
  return highScore;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(COUNT_SPACE_REGEXP, " ");
}

/**
 * Scores how well `query` fuzzy-matches `text`. Returns 0..1, where 1 is a
 * perfect/complete match. `aliases` (optional) are appended to the searched
 * text so a node can match on secondary labels (e.g. a file's full path as
 * an alias for its display name) without changing what gets rendered.
 */
export function fuzzyScore(text: string, query: string, aliases: string[] = []): number {
  const searchable = aliases.length > 0 ? `${text} ${aliases.join(" ")}` : text;
  return fuzzyScoreInner(searchable, query, normalize(searchable), normalize(query), 0, 0, {});
}
