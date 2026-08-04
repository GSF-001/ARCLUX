// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { ManifestParser, ManifestDependency } from "../core/ManifestParserInterface";

// Java has 2 unrelated manifest formats depending on the build tool — both
// live in this one file since both produce the same ManifestDependency
// shape and neither is complex enough alone to warrant a separate file
// (unlike e.g. parseGo.ts vs parseGoMod.ts, which are source vs manifest).
//
// Gradle (build.gradle, Groovy DSL): matches
// implementation/api/testImplementation/compileOnly 'group:artifact:version'
// (single or double-quoted). Does NOT handle build.gradle.kts (Kotlin DSL,
// different call syntax) or version catalogs (libs.versions.toml).
//
// Maven (pom.xml): matches <dependency> blocks with <groupId>/<artifactId>/
// <version>, via regex rather than real XML parsing — same rationale as
// parseCsproj.ts. <scope>test</scope> maps to "dev", anything else (or no
// scope, which defaults to "compile") maps to "runtime".

function parseGradle(content: string): ManifestDependency[] {
  const dependencies: ManifestDependency[] = [];
  const pattern =
    /\b(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s*[(]?\s*['"]([^:'"]+):([^:'"]+):([^'"]+)['"]/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const [, group, artifact, version] = match;
    dependencies.push({
      name: `${group}:${artifact}`,
      versionRange: version,
      kind: /testImplementation/.test(match[0]) ? "dev" : "runtime",
    });
  }

  return dependencies;
}

function parseMaven(content: string): ManifestDependency[] {
  const dependencies: ManifestDependency[] = [];
  const blockPattern = /<dependency>([\s\S]*?)<\/dependency>/g;

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockPattern.exec(content)) !== null) {
    const block = blockMatch[1];
    const groupId = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1];
    const artifactId = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1];
    const version = block.match(/<version>([^<]+)<\/version>/)?.[1];
    const scope = block.match(/<scope>([^<]+)<\/scope>/)?.[1];

    if (!groupId || !artifactId) continue;

    dependencies.push({
      name: `${groupId}:${artifactId}`,
      versionRange: version,
      kind: scope === "test" ? "dev" : "runtime",
    });
  }

  return dependencies;
}

export const parseGradle_: ManifestParser = {
  filename: "build.gradle",
  parse: parseGradle,
};

export const parsePom: ManifestParser = {
  filename: "pom.xml",
  parse: parseMaven,
};
