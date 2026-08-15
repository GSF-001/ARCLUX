// Copyright 2026 ARCLUX
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Same limitation as packages/diff/architecturalDiff.ts: does not check
// out git refs itself. Caller supplies both file contents (from working
// tree, git show, stash, etc). Uses the real parser via ParserRegistry —
// does not reimplement AST walking here.

import { parserRegistry } from "../parser/core/ParserRegistry";
import type { FileInfo } from "../shared/types";

export interface AstDiffResult {
  filePath: string;
  importsAdded: string[];
  importsRemoved: string[];
  exportsAdded: string[];
  exportsRemoved: string[];
}

export async function computeAstDiff(
  fileBefore: FileInfo,
  contentBefore: string,
  fileAfter: FileInfo,
  contentAfter: string
): Promise<AstDiffResult> {
  const parser = parserRegistry.getParserOrThrow(fileAfter.extension);

  const [before, after] = await Promise.all([
    parser.parse(fileBefore, contentBefore),
    parser.parse(fileAfter, contentAfter),
  ]);

  const beforeImports = new Set(before.imports.map((i) => i.source));
  const afterImports = new Set(after.imports.map((i) => i.source));
  const beforeExports = new Set(before.exports.map((e) => e.name));
  const afterExports = new Set(after.exports.map((e) => e.name));

  return {
    filePath: fileAfter.relativePath,
    importsAdded: [...afterImports].filter((s) => !beforeImports.has(s)),
    importsRemoved: [...beforeImports].filter((s) => !afterImports.has(s)),
    exportsAdded: [...afterExports].filter((s) => !beforeExports.has(s)),
    exportsRemoved: [...beforeExports].filter((s) => !afterExports.has(s)),
  };
}
