// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { createRequire } from "node:module";
import { getPythonRuntime } from "./parsePython";
import { PYTHON_HIGHLIGHTS_QUERY } from "./pythonHighlightQuery";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TreeSitter: any = require("web-tree-sitter");
const { Query } = TreeSitter;

export type SyntaxTokenType =
  | "comment"
  | "keyword"
  | "string"
  | "variable"
  | "property"
  | "type"
  | "constant"
  | "operator"
  | "punctuation";

export interface HighlightToken {
  startIndex: number;
  endIndex: number;
  text: string;
  tokenType: SyntaxTokenType;
}

/**
 * Maps tree-sitter-python's highlight capture names to Arclux's theme
 * syntax tokens (theme/colors.ts / theme/theme.dark.ts `syntax` fields).
 *
 * Multiple captures often share the EXACT same span — e.g. a function name
 * is matched by both the generic `(identifier) @variable` pattern AND a
 * more specific `@function` pattern in the same query. Array order below is
 * priority: earlier entries win when spans collide.
 *
 * @escape, @punctuation.special and @embedded (f-string interpolation
 * internals) are intentionally NOT mapped — their spans nest INSIDE a
 * @string span rather than colliding with it, and resolving nested (not
 * just duplicate) spans correctly needs a real interval tree. Out of scope
 * for this first pass — those characters just render as plain text.
 */
const CAPTURE_PRIORITY: Array<{ name: string; kind: SyntaxTokenType }> = [
  { name: "function.builtin", kind: "property" },
  { name: "function.method", kind: "property" },
  { name: "function", kind: "property" },
  { name: "constructor", kind: "type" },
  { name: "type", kind: "type" },
  { name: "constant.builtin", kind: "constant" },
  { name: "constant", kind: "constant" },
  { name: "number", kind: "constant" },
  { name: "property", kind: "property" },
  { name: "comment", kind: "comment" },
  { name: "string", kind: "string" },
  { name: "keyword", kind: "keyword" },
  { name: "operator", kind: "operator" },
  { name: "variable", kind: "variable" },
];

const PRIORITY_INDEX = new Map(CAPTURE_PRIORITY.map((c, i) => [c.name, i]));

interface RawCapture {
  name: string;
  startIndex: number;
  endIndex: number;
  text: string;
}

/**
 * web-tree-sitter has shipped both `language.query(source)` (older,
 * deprecated) and `new Query(language, source)` (newer) across versions —
 * see PROGRES.md gotchas for the last time this package's API shifted
 * under us. Try the modern constructor first, fall back to the method.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createHighlightQuery(language: any): any {
  if (typeof Query === "function") {
    return new Query(language, PYTHON_HIGHLIGHTS_QUERY);
  }
  return language.query(PYTHON_HIGHLIGHTS_QUERY);
}

/**
 * Runs the highlights query against Python source and returns a flat,
 * non-overlapping list of highlight tokens sorted by position.
 *
 * STATUS: not yet verified against real rendered output in a browser —
 * only exercised via tsc --noEmit so far. Most likely failure points if
 * colors land on the wrong characters: (1) createHighlightQuery picked the
 * wrong branch for the installed web-tree-sitter version, or (2) capture
 * names below don't match what this version of tree-sitter-python's grammar
 * actually emits. Check both before assuming the priority/mapping logic
 * itself is wrong.
 */
export async function highlightPythonSource(source: string): Promise<HighlightToken[]> {
  const { parser, language } = await getPythonRuntime();
  const tree = parser.parse(source);
  const query = createHighlightQuery(language);

  const matches = query.matches(tree.rootNode) as Array<{
    captures: Array<{ name: string; node: { text: string; startIndex: number; endIndex: number } }>;
  }>;

  const raw: RawCapture[] = [];
  for (const match of matches) {
    for (const capture of match.captures) {
      if (!PRIORITY_INDEX.has(capture.name)) continue;
      raw.push({
        name: capture.name,
        startIndex: capture.node.startIndex,
        endIndex: capture.node.endIndex,
        text: capture.node.text,
      });
    }
  }

  const bySpan = new Map<string, RawCapture>();
  for (const cap of raw) {
    const key = `${cap.startIndex}-${cap.endIndex}`;
    const existing = bySpan.get(key);
    if (!existing || PRIORITY_INDEX.get(cap.name)! < PRIORITY_INDEX.get(existing.name)!) {
      bySpan.set(key, cap);
    }
  }

  return Array.from(bySpan.values())
    .map((cap) => ({
      startIndex: cap.startIndex,
      endIndex: cap.endIndex,
      text: cap.text,
      tokenType: CAPTURE_PRIORITY[PRIORITY_INDEX.get(cap.name)!].kind,
    }))
    .sort((a, b) => a.startIndex - b.startIndex);
}
