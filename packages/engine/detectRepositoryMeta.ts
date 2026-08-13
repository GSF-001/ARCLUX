// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RepositoryMeta } from "../shared/types";

/**
 * Maps a dependency name to the framework it implies, matching the folder names
 * under packages/rules/* (electron, express, nestjs, nextjs, react, vite).
 * Order matters: more specific frameworks (nestjs, nextjs) are checked before
 * their more general underlying runtime (react is a dependency of nextjs too,
 * so a Next.js app should report both "nextjs" and "react", but plain Express
 * shouldn't also report "react").
 *
 * laravel is NOT in this list on purpose: it comes from composer.json's
 * `require`, not package.json, so it's handled by a separate check in
 * detectFrameworks() below.
 */
const FRAMEWORK_MARKERS: Array<{ dependency: string; framework: string }> = [
  { dependency: "next", framework: "nextjs" },
  { dependency: "@nestjs/core", framework: "nestjs" },
  { dependency: "express", framework: "express" },
  { dependency: "vite", framework: "vite" },
  { dependency: "electron", framework: "electron" },
  { dependency: "react", framework: "react" },
];

const LOCKFILE_MARKERS: Array<{ filename: string; packageManager: RepositoryMeta["packageManager"] }> = [
  { filename: "pnpm-lock.yaml", packageManager: "pnpm" },
  { filename: "yarn.lock", packageManager: "yarn" },
  { filename: "package-lock.json", packageManager: "npm" },
];

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface ComposerJsonShape {
  require?: Record<string, string>;
}

/**
 * Reads package.json at the repo root (if any) and returns every dependency name,
 * merging `dependencies` and `devDependencies`. Never throws — a missing or
 * malformed package.json just means "no frameworks detected", it shouldn't
 * fail the whole analysis pipeline.
 */
function readDependencyNames(rootPath: string): Set<string> {
  const packageJsonPath = join(rootPath, "package.json");
  if (!existsSync(packageJsonPath)) {
    return new Set();
  }

  try {
    const raw = readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(raw) as PackageJsonShape;
    return new Set([
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

/**
 * Reads composer.json at the repo root (if any) and returns the names of
 * every package in `require`. Mirrors readDependencyNames() above: a flat
 * Set<string> of names is all framework detection needs, not full
 * ManifestDependency objects — same reason parsePackageJson.ts's comment
 * gives for keeping readDependencyNames separate from the ManifestParser
 * system (parseComposer.ts is left untouched and unused here).
 * Never throws — a missing or malformed composer.json means "no PHP
 * frameworks detected".
 */
function readComposerRequireNames(rootPath: string): Set<string> {
  const composerJsonPath = join(rootPath, "composer.json");
  if (!existsSync(composerJsonPath)) {
    return new Set();
  }

  try {
    const raw = readFileSync(composerJsonPath, "utf-8");
    const parsed = JSON.parse(raw) as ComposerJsonShape;
    return new Set(Object.keys(parsed.require ?? {}));
  } catch {
    return new Set();
  }
}

/**
 * Detects which frameworks a repo uses by inspecting package.json
 * dependencies and composer.json's `require`. Returns e.g. ["nextjs",
 * "react"] for a Next.js app, ["laravel"] for a PHP app with
 * laravel/framework, [] if neither manifest exists/matches nothing known.
 */
export function detectFrameworks(rootPath: string): string[] {
  const frameworks: string[] = [];

  const dependencyNames = readDependencyNames(rootPath);
  if (dependencyNames.size > 0) {
    for (const marker of FRAMEWORK_MARKERS) {
      if (dependencyNames.has(marker.dependency)) {
        frameworks.push(marker.framework);
      }
    }
  }

  // Laravel comes from composer.json, not package.json — a PHP app may
  // have no package.json at all, so this check must not be gated behind
  // the package.json read above.
  if (readComposerRequireNames(rootPath).has("laravel/framework")) {
    frameworks.push("laravel");
  }

  return frameworks;
}

/**
 * Detects the package manager a repo uses by checking for its lockfile at the
 * repo root. Checked in order pnpm -> yarn -> npm since a repo might have a
 * stray lockfile left over from switching tools; the first match wins.
 * Returns "unknown" if no recognized lockfile is present.
 */
export function detectPackageManager(rootPath: string): RepositoryMeta["packageManager"] {
  for (const marker of LOCKFILE_MARKERS) {
    if (existsSync(join(rootPath, marker.filename))) {
      return marker.packageManager;
    }
  }

  return "unknown";
}
