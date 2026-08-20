// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Shared tree-sitter WASM loader for the language parsers. Every
// tree-sitter-backed parser (python today, php/ruby/rust/cpp/csharp via
// this helper) loads its grammar through here so the fragile parts — the
// wasm path lookup and the single-load-per-process caching — live in ONE
// place instead of being copy-pasted per language.
//
// GOTCHA (see progres/bugs.md): never use nodeRequire.resolve() for the
// wasm path — it resolves relative to the webpack bundle, not the real
// filesystem. Walk upward from process.cwd() instead.

import { createRequire } from "node:module";
import path from "node:path";
import { existsSync } from "node:fs";

const nodeRequire = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TreeSitter: any = nodeRequire("web-tree-sitter");
const { Parser, Language } = TreeSitter;

/** Minimal structural type for the parts of a web-tree-sitter node we use. */
export interface TSNode {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  childCount: number;
  child(index: number): TSNode | null;
  childForFieldName(name: string): TSNode | null;
  namedChildren: (TSNode | null)[];
}

export interface TreeSitterRuntime {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parser: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  language: any;
}

const runtimeCache = new Map<string, Promise<TreeSitterRuntime>>();

/** 1-indexed source line for a node. */
export function nodeLine(node: TSNode): number {
  return node.startPosition.row + 1;
}

function findWasmPath(grammarFile: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(
      dir,
      "node_modules",
      "tree-sitter-wasms",
      "out",
      grammarFile
    );
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not find tree-sitter-wasms/out/${grammarFile} by walking up from ${process.cwd()}`
  );
}

/**
 * Loads (once) and returns a cached Parser for the given grammar wasm
 * filename, e.g. "tree-sitter-php.wasm". Safe to call from any number of
 * parsers — each grammar is initialized exactly once per process.
 */
export function getTreeSitterRuntime(grammarFile: string): Promise<TreeSitterRuntime> {
  if (!runtimeCache.has(grammarFile)) {
    runtimeCache.set(
      grammarFile,
      (async () => {
        await Parser.init();
        const parser = new Parser();
        const wasmPath = findWasmPath(grammarFile);
        const language = await Language.load(wasmPath);
        parser.setLanguage(language);
        return { parser, language };
      })()
    );
  }
  return runtimeCache.get(grammarFile)!;
}

/** Walks a tree with a visitor; children of every node are visited. */
export function walk(node: TSNode | null, visit: (n: TSNode) => void): void {
  if (!node) return;
  visit(node);
  for (const child of node.namedChildren) {
    walk(child, visit);
  }
}

/** Children matching the given node types (shallow scan of one level). */
export function childrenOfType(node: TSNode | null, types: string[]): TSNode[] {
  if (!node) return [];
  const out: TSNode[] = [];
  for (const child of node.namedChildren) {
    if (child && types.includes(child.type)) out.push(child);
  }
  return out;
}