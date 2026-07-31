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
 * Detects which frameworks a repo uses by inspecting package.json dependencies.
 * Returns e.g. ["nextjs", "react"] for a Next.js app, [] if package.json is
 * missing/malformed or matches nothing known.
 */
export function detectFrameworks(rootPath: string): string[] {
  const dependencyNames = readDependencyNames(rootPath);
  if (dependencyNames.size === 0) {
    return [];
  }

  const frameworks: string[] = [];
  for (const marker of FRAMEWORK_MARKERS) {
    if (dependencyNames.has(marker.dependency)) {
      frameworks.push(marker.framework);
    }
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
