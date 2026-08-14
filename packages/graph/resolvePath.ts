// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { posix } from "node:path";
import { resolveAlias, type AliasConfig } from "./resolveAliases";

const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"];
const INDEX_FILENAMES = [
  ...RESOLVABLE_EXTENSIONS.filter((ext) => ext !== ".py").map((ext) => `index${ext}`),
  "__init__.py", // Python's equivalent of index.ts for package-style relative imports
];

export type PathResolution =
  | { type: "internal"; moduleId: string }
  | { type: "external"; packageName: string };

/**
 * Resolves a raw import source (e.g. "../utils/foo", "react", "@/lib/api",
 * or Python's "utils", ".", "..pkg") to either an internal module id
 * (relative path in the repo) or an external package.
 *
 * `knownFiles` is the set of relativePaths that scanFiles.ts found — used to verify
 * a resolved candidate actually exists before committing to it.
 *
 * `aliasConfig` (from graph/resolveAliases.ts) is optional so callers that don't
 * care about tsconfig path aliases (e.g. tests) can omit it.
 */
export function resolvePath(
  importerRelativePath: string,
  importSource: string,
  knownFiles: Set<string>,
  aliasConfig?: AliasConfig
): PathResolution {
  // Path alias, e.g. "@/lib/api" -> try candidates from tsconfig `paths` first,
  // since these don't start with "." or "/" but are NOT external packages.
  if (aliasConfig && aliasConfig.rules.length > 0) {
    const aliasCandidates = resolveAlias(importSource, aliasConfig);
    for (const candidate of aliasCandidates) {
      const resolved = tryResolveInternal(candidate, knownFiles);
      if (resolved) return resolved;
    }
    // Matched an alias prefix but no real file found — still not an npm package,
    // so don't fall through to the bare-specifier branch below.
    if (aliasCandidates.length > 0) {
      return { type: "external", packageName: importSource };
    }
  }

  const importerDir = posix.dirname(importerRelativePath);

  // Explicit relative import: JS/TS "./x", "../x", or Python's explicit
  // relative form "." / ".." / "..pkg" (from a `from . import x` /
  // `from ..pkg import x` statement — see parsePython.ts).
  if (importSource.startsWith(".") || importSource.startsWith("/")) {
    const rawTarget = posix.normalize(posix.join(importerDir, importSource));
    const resolved = tryResolveInternal(rawTarget, knownFiles);
    if (resolved) return resolved;
    return { type: "external", packageName: importSource };
  }

  // Bare specifier, e.g. "react", "lodash/get" — OR Python's "utils" in
  // `from utils import x` for a sibling utils.py in the SAME directory.
  //
  // In JS/TS a bare specifier is ALWAYS an npm package; relative imports
  // there require an explicit "./" prefix, no exceptions. Python has no such
  // rule — `from utils import x` with zero dots is a completely normal,
  // common way to import a sibling module. So before assuming "external
  // package" we try resolving the bare specifier as same-directory file
  // first. For JS/TS repos this is effectively a no-op (a real npm package
  // name almost never happens to collide with a same-named file sitting
  // right next to the importer), but it's what makes Python sibling
  // imports resolve at all instead of always being (wrongly) treated as
  // external and silently dropped from the dependency graph.
  const siblingCandidate = posix.normalize(posix.join(importerDir, importSource));
  const siblingResolved = tryResolveInternal(siblingCandidate, knownFiles);
  if (siblingResolved) return siblingResolved;

  // Python dotted absolute imports: `import src.core.embedder` or
  // `from src.core import embedder` both produce a source string like
  // "src.core.embedder" (dots, not slashes). JS/TS never uses dots as
  // path separators, so a bare specifier containing dots is unambiguously
  // a Python dotted module path. Convert dots → slashes and try from
  // repo root before giving up and treating it as an external package.
  //
  // We only do this when the source contains a dot that isn't a leading
  // dot (relative imports like "." and "..pkg" are already handled above
  // by the startsWith(".") branch).
  if (importSource.includes(".") && !importSource.startsWith(".")) {
    const dottedAsPath = importSource.replace(/\./g, "/");
    // Try from repo root first (absolute dotted import: `import src.core.X`)
    const rootResolved = tryResolveInternal(dottedAsPath, knownFiles);
    if (rootResolved) return rootResolved;
    // Try relative to importer dir (package-relative: `from utils.helpers import X`
    // when utils/ is a sibling of the importer)
    const relResolved = tryResolveInternal(
      posix.normalize(posix.join(importerDir, dottedAsPath)),
      knownFiles
    );
    if (relResolved) return relResolved;
  }

  const parts = importSource.split("/");
  const packageName = importSource.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  return { type: "external", packageName };
}

/**
 * Tries a repo-root-relative candidate path directly, then with resolvable
 * extensions appended, then as a directory index. Shared by both the relative-import
 * path and the alias-resolved path above, since both land on the same kind of
 * "candidate path that might need an extension or /index" problem.
 */
function tryResolveInternal(candidate: string, knownFiles: Set<string>): PathResolution | undefined {
  if (knownFiles.has(candidate)) {
    return { type: "internal", moduleId: candidate };
  }

  for (const ext of RESOLVABLE_EXTENSIONS) {
    const withExt = candidate + ext;
    if (knownFiles.has(withExt)) {
      return { type: "internal", moduleId: withExt };
    }
  }

  for (const indexFile of INDEX_FILENAMES) {
    const withIndex = posix.join(candidate, indexFile);
    if (knownFiles.has(withIndex)) {
      return { type: "internal", moduleId: withIndex };
    }
  }

  return undefined;
}
