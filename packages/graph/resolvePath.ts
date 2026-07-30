import { posix } from "node:path";

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
 */
export function resolvePath(
  importerRelativePath: string,
  importSource: string,
  knownFiles: Set<string>
): PathResolution {
  // Bare specifier = external package, e.g. "react", "lodash/get"
  if (!importSource.startsWith(".") && !importSource.startsWith("/")) {
    // npm scoped or plain package name is everything up to the 2nd "/" for scoped, or 1st "/" otherwise
    const parts = importSource.split("/");
    const packageName = importSource.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    return { type: "external", packageName };
  }

  const importerDir = posix.dirname(importerRelativePath);
  const rawTarget = posix.normalize(posix.join(importerDir, importSource));

  // 1. Exact match (import already had an extension)
  if (knownFiles.has(rawTarget)) {
    return { type: "internal", moduleId: rawTarget };
  }

  // 2. Try appending resolvable extensions: "./foo" -> "./foo.ts"
  for (const ext of RESOLVABLE_EXTENSIONS) {
    const candidate = rawTarget + ext;
    if (knownFiles.has(candidate)) {
      return { type: "internal", moduleId: candidate };
    }
  }

  // 3. Try as a directory index: "./foo" -> "./foo/index.ts"
  for (const indexFile of INDEX_FILENAMES) {
    const candidate = posix.join(rawTarget, indexFile);
    if (knownFiles.has(candidate)) {
      return { type: "internal", moduleId: candidate };
    }
  }

  // Unresolvable (e.g. path alias not yet handled by resolveAlias.ts, or genuinely missing file).
  // Fall back to treating it as external so the pipeline doesn't crash — indexer can flag these separately.
  return { type: "external", packageName: importSource };
}
