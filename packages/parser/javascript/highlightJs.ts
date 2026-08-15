// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Same pattern as packages/parser/python/highlightPython.ts, generalized
// to accept a wasm filename so JS and TS (and future languages) share one
// loader instead of duplicating the walk-up-from-cwd wasm resolution logic.
// CRITICAL, per parsePython.ts's own comment (regressed twice before):
// NEVER call require.resolve() or nodeRequire.resolve() here -- it returns
// a webpack-bundle-relative path, not a real filesystem path, inside
// Next.js's webpack runtime. Always walk up from process.cwd() instead.
//
// Highlight query merges tree-sitter-javascript's queries/highlights.scm
// (base tokens: keyword, string, comment, function, operator, etc) with
// tree-sitter-typescript's TS-specific additions (type, interface,
// namespace keywords, etc) -- fetched from the official grammar repos,
// not written from scratch. TSX-specific JSX captures not included --
// out of scope for a first pass, .tsx files fall back to the base JS/TS
// captures (JSX tag names etc render as plain text, not a rendering bug).

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import type { HighlightToken, SyntaxTokenType } from "./highlightTypes";
import { JS_TS_HIGHLIGHTS_QUERY } from "./jsTsHighlightQuery";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TreeSitter: any = require("web-tree-sitter");
const { Parser, Language, Query } = TreeSitter;

const CAPTURE_PRIORITY: Array<{ name: string; kind: SyntaxTokenType }> = [
  { name: "constructor", kind: "type" },
  { name: "type", kind: "type" },
  { name: "type.builtin", kind: "type" },
  { name: "constant.builtin", kind: "constant" },
  { name: "constant", kind: "constant" },
  { name: "number", kind: "constant" },
  { name: "function.builtin", kind: "property" },
  { name: "function.method", kind: "property" },
  { name: "function", kind: "property" },
  { name: "property", kind: "property" },
  { name: "comment", kind: "comment" },
  { name: "string", kind: "string" },
  { name: "string.special", kind: "string" },
  { name: "keyword", kind: "keyword" },
  { name: "operator", kind: "operator" },
  { name: "variable.builtin", kind: "variable" },
  { name: "variable.parameter", kind: "variable" },
  { name: "variable", kind: "variable" },
];

const PRIORITY_INDEX = new Map(CAPTURE_PRIORITY.map((c, i) => [c.name, i]));

interface RawCapture {
  name: string;
  startIndex: number;
  endIndex: number;
  text: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtimeCache = new Map<string, Promise<any>>();

function findWasmPath(wasmFilename: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "node_modules", "tree-sitter-wasms", "out", wasmFilename);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not find tree-sitter-wasms/out/${wasmFilename} by walking up from ${process.cwd()}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRuntime(wasmFilename: string): Promise<any> {
  const cached = runtimeCache.get(wasmFilename);
  if (cached) return cached;

  const promise = (async () => {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = findWasmPath(wasmFilename);
    const language = await Language.load(wasmPath);
    parser.setLanguage(language);
    return { parser, language };
  })();

  runtimeCache.set(wasmFilename, promise);
  return promise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createHighlightQuery(language: any): any {
  if (typeof Query === "function") {
    return new Query(language, JS_TS_HIGHLIGHTS_QUERY);
  }
  return language.query(JS_TS_HIGHLIGHTS_QUERY);
}

async function highlightWith(source: string, wasmFilename: string): Promise<HighlightToken[]> {
  const { parser, language } = await getRuntime(wasmFilename);
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

export function highlightJavaScriptSource(source: string): Promise<HighlightToken[]> {
  return highlightWith(source, "tree-sitter-javascript.wasm");
}

export function highlightTypeScriptSource(source: string): Promise<HighlightToken[]> {
  return highlightWith(source, "tree-sitter-typescript.wasm");
}
