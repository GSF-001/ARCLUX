import { posix } from "node:path";
import { resolveAlias, type AliasConfig } from "../indexer/resolveAliases";

const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const INDEX_FILENAMES = RESOLVABLE_EXTENSIONS.map((ext) => `index${ext}`);

export type PathResolution =
  | { type: "internal"; moduleId: string }
  | { type: "external"; packageName: string };

/**
 * Resolves a raw import source (e.g. "../utils/foo", "react", "@/lib/api")
 * to either an internal module id (relative path in the repo) or an external package.
 *
 * `knownFiles` is the set of relativePaths that scanFiles.ts found — used to verify
 * a resolved candidate actually exists before committing to it.
 *
 * `aliasConfig` (from indexer/resolveAliases.ts) is optional so callers that don't
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

  // Bare specifier = external package, e.g. "react", "lodash/get"
  if (!importSource.startsWith(".") && !importSource.startsWith("/")) {
    // npm scoped or plain package name is everything up to the 2nd "/" for scoped, or 1st "/" otherwise
    const parts = importSource.split("/");
    const packageName = importSource.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    return { type: "external", packageName };
  }

  const importerDir = posix.dirname(importerRelativePath);
  const rawTarget = posix.normalize(posix.join(importerDir, importSource));

  const resolved = tryResolveInternal(rawTarget, knownFiles);
  if (resolved) return resolved;

  // Unresolvable (genuinely missing file, or an alias target that doesn't exist on disk).
  // Fall back to treating it as external so the pipeline doesn't crash — indexer can flag these separately.
  return { type: "external", packageName: importSource };
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
