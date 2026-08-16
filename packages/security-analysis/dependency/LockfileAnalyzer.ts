// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Lockfile analysis: extracts PINNED (exact) versions from lockfiles,
// complementing the core engine's ManifestDependency[] which only carries
// manifest version RANGES (e.g. "^1.2.0"). A vulnerability check needs the
// exact installed version, so this is where the security layer gets it.
//
// Honest scope: parsing is regex/JSON-minimal per format, not a full
// spec implementation. Supported: package-lock.json (npm v1/v2/v3),
// pnpm-lock.yaml, yarn.lock, go.sum, Cargo.lock, composer.lock.
// Unsupported formats are skipped (returned in `skipped`).

import type { SourceProvider } from "../SourceProvider";

export interface LockedDependency {
  name: string;
  /** Exact pinned version, normalized (leading "v" stripped). */
  version: string;
  manager: "npm" | "pnpm" | "yarn" | "go" | "cargo" | "composer";
  lockfilePath: string;
  /** 1 = direct (declared in a manifest), 2+ = transitive (nested). npm only; others are all 1. */
  depth: number;
}

export interface LockfileParseResult {
  dependencies: LockedDependency[];
  lockfilesFound: string[];
  /** Files that exist but whose format is unsupported. */
  skipped: string[];
}

export const LOCKFILE_NAMES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "go.sum",
  "Cargo.lock",
  "composer.lock",
] as const;

export type LockfileName = (typeof LOCKFILE_NAMES)[number];

/** Strip a leading "v"/"=" and whitespace so semver comparison works. */
export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^[v=]\s*/, "");
}

export function parseLockfiles(sources: SourceProvider, filenames: readonly string[] = LOCKFILE_NAMES): LockfileParseResult {
  const dependencies: LockedDependency[] = [];
  const lockfilesFound: string[] = [];
  const skipped: string[] = [];

  for (const filename of filenames) {
    const content = sources.read(filename);
    if (content === null) continue;
    lockfilesFound.push(filename);

    switch (filename) {
      case "package-lock.json":
        dependencies.push(...parsePackageLock(content, filename));
        break;
      case "pnpm-lock.yaml":
        dependencies.push(...parsePnpmLock(content, filename));
        break;
      case "yarn.lock":
        dependencies.push(...parseYarnLock(content, filename));
        break;
      case "go.sum":
        dependencies.push(...parseGoSum(content, filename));
        break;
      case "Cargo.lock":
        dependencies.push(...parseCargoLock(content, filename));
        break;
      case "composer.lock":
        dependencies.push(...parseComposerLock(content, filename));
        break;
      default:
        skipped.push(filename);
    }
  }

  return { dependencies, lockfilesFound, skipped };
}

function parsePackageLock(content: string, lockfilePath: string): LockedDependency[] {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return [];
  }
  const out: LockedDependency[] = [];

  interface NpmDep {
    version?: string;
    dependencies?: Record<string, NpmDep>;
  }
  const root = json as { packages?: Record<string, { version?: string }>; dependencies?: Record<string, NpmDep> };

  // npm v7+ (lockfileVersion 2/3): flat "packages" — direct = path without nested node_modules
  if (root.packages) {
    for (const [pkgPath, info] of Object.entries(root.packages)) {
      if (pkgPath === "") continue;
      const version = info.version;
      if (!version) continue;
      const isTransitive = pkgPath.split("node_modules/").length > 2;
      // name = last path segment (scoped: @scope/name keeps its slash)
      const segments = pkgPath.split("node_modules/");
      const name = segments[segments.length - 1] ?? pkgPath;
      out.push({
        name,
        version: normalizeVersion(version),
        manager: "npm",
        lockfilePath,
        // "node_modules/x" = direct (depth 1); "node_modules/a/node_modules/b" = transitive
        depth: segments.length - 1,
      });
    }
  }

  if (root.dependencies) {
    const walk = (deps: Record<string, NpmDep>, depth: number) => {
      for (const [name, info] of Object.entries(deps)) {
        if (info.version) {
          out.push({ name, version: normalizeVersion(info.version), manager: "npm", lockfilePath, depth });
        }
        if (info.dependencies) walk(info.dependencies, depth + 1);
      }
    };
    walk(root.dependencies, 1);
  }

  return out;
}

function parsePnpmLock(content: string, lockfilePath: string): LockedDependency[] {
  const out: LockedDependency[] = [];
  // Blocks: "  /pkg@1.2.3:" (scoped: "/@scope/pkg@1.2.3") or "  pkg@1.2.3:"
  const re = /^\s{2}\/?((?:@[^/]+\/)?[^/@\s]+)@(\d+\.\d+\.\d+):/gm;
  for (const match of content.matchAll(re)) {
    out.push({ name: match[1]!, version: match[2]!, manager: "pnpm", lockfilePath, depth: 1 });
  }
  return out;
}

function parseYarnLock(content: string, lockfilePath: string): LockedDependency[] {
  const out: LockedDependency[] = [];
  // Blocks: 'name@range:' then '  version "1.2.3"'
  const blockRe = /^([^\n]+):\n((?:[ \t]+.*\n?)*)/gm;
  for (const block of content.matchAll(blockRe)) {
    const header = block[1] ?? "";
    const body = block[2] ?? "";
    const versionMatch = body.match(/^\s+version\s+"([^"]+)"/m);
    if (!versionMatch) continue;
    // header may be "name@^1.0.0, name@^1.1.0" — take the first quoted piece
    const nameMatch = header.match(/"((?:@[^/]+\/)?[^@"]+)@/);
    const name = nameMatch?.[1] ?? header.split("@")[0];
    out.push({ name, version: normalizeVersion(versionMatch[1]!), manager: "yarn", lockfilePath, depth: 1 });
  }
  return out;
}

function parseGoSum(content: string, lockfilePath: string): LockedDependency[] {
  const out: LockedDependency[] = [];
  const re = /^([^\s]+)\s+(v\d+\.\d+\.\d+(?:[^\s]*)?)\s+h1:/gm;
  for (const match of content.matchAll(re)) {
    out.push({ name: match[1]!, version: normalizeVersion(match[2]!), manager: "go", lockfilePath, depth: 1 });
  }
  return out;
}

function parseCargoLock(content: string, lockfilePath: string): LockedDependency[] {
  const out: LockedDependency[] = [];
  const re = /name\s*=\s*"([^"]+)"\s*\n\s*version\s*=\s*"([^"]+)"/g;
  for (const match of content.matchAll(re)) {
    out.push({ name: match[1]!, version: normalizeVersion(match[2]!), manager: "cargo", lockfilePath, depth: 1 });
  }
  return out;
}

function parseComposerLock(content: string, lockfilePath: string): LockedDependency[] {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return [];
  }
  const packages = (json as { packages?: Array<{ name?: string; version?: string }> }).packages ?? [];
  const out: LockedDependency[] = [];
  for (const pkg of packages) {
    if (!pkg.name || !pkg.version) continue;
    out.push({ name: pkg.name, version: normalizeVersion(pkg.version), manager: "composer", lockfilePath, depth: 1 });
  }
  return out;
}
