import { sep, posix } from "node:path";

/**
 * Converts an OS-specific path (with "\" on Windows) to POSIX-style ("/").
 * Every relativePath stored in FileInfo/ModuleInfo must go through this —
 * module ids are compared as plain strings elsewhere (resolvePath.ts,
 * Repository.ts), so mixed separators would silently break lookups.
 */
export function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}

/** Joins path segments using POSIX rules, regardless of host OS. */
export function joinPosix(...segments: string[]): string {
  return posix.join(...segments);
}

/** Normalizes a POSIX path (resolves "..", ".", duplicate slashes). */
export function normalizePosix(path: string): string {
  return posix.normalize(path);
}

/**
 * True if `childPath` is `parentPath` itself or nested inside it. Both must
 * already be POSIX-style relative paths (e.g. from FileInfo.relativePath).
 */
export function isSubPath(parentPath: string, childPath: string): boolean {
  const normalizedParent = normalizePosix(parentPath).replace(/\/$/, "");
  const normalizedChild = normalizePosix(childPath);
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}/`);
}
