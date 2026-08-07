// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * One dependency entry extracted from a manifest file (package.json,
 * go.mod, Cargo.toml, Gemfile, composer.json, .csproj, build.gradle/pom.xml).
 * Intentionally much thinner than ParsedFile/LanguageParser — a manifest is
 * a flat declaration, not source code with imports/exports/warnings.
 */
export interface ManifestDependency {
  name: string;
  /** Version range/spec as written in the manifest, e.g. "^1.2.0" or "v1.2.0". Absent if unversioned. */
  versionRange?: string;
  kind: "runtime" | "dev";
}

/**
 * Every manifest parser (parsePackageJson, parseGoMod, parseCargoToml, ...)
 * implements this. Synchronous and content-only (no FileInfo) since manifest
 * files are small, single, well-known filenames read directly by
 * detectRepositoryMeta.ts — no repo-wide scan/registry involved, unlike
 * LanguageParser/ParserRegistry which cover arbitrary source files.
 */
export interface ManifestParser {
  /** Exact filename this parser handles, e.g. "go.mod", "Cargo.toml" */
  readonly filename: string;

  /**
   * Parses manifest content into a flat dependency list. Must NOT throw on
   * malformed input — return [] instead, so one broken manifest doesn't
   * fail framework/package-manager detection for the whole repo.
   */
  parse(content: string): ManifestDependency[];
}
