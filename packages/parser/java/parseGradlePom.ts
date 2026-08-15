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

  // Strip non-project <dependency> contexts BEFORE matching blocks:
  //   - <plugin><dependencies>   — the PLUGIN's own classpath, not the
  //     project's (Maven compiles/executes the plugin with those, they do
  //     not land on the project's dependency list).
  //   - <dependencyManagement>    — version management only; entries there
  //     do not add anything to the classpath unless also declared under
  //     <dependencies>.
  // Neither section nests itself nor contains the other, and profiles
  // (<profiles><profile><dependencies>) are NOT stripped — their
  // dependencies ARE project dependencies (conditional, but real).
  const projectOnly = content
    .replace(/<plugin>[\s\S]*?<\/plugin>/g, "")
    .replace(/<dependencyManagement>[\s\S]*?<\/dependencyManagement>/g, "");

  // Resolve <version>${...}</version> references against the <properties>
  // section of the SAME pom (Maven's standard version-property pattern,
  // e.g. <spring.version>6.1.0</spring.version> + <version>${spring.version}</version>).
  // Properties that reference other properties resolve iteratively (bounded);
  // unknown refs (including self-version refs like ${project.version}) stay
  // literal rather than being guessed.
  const properties = extractMavenProperties(content);
  const resolveVersion = (raw: string | undefined): string | undefined => {
    if (!raw) return undefined;
    let out = raw;
    for (let pass = 0; pass < 5; pass++) {
      const next = out.replace(/\$\{([^}]+)\}/g, (_, key: string) => properties[key] ?? `\${${key}}`);
      if (next === out) break;
      out = next;
    }
    return out;
  };

  const blockPattern = /<dependency>([\s\S]*?)<\/dependency>/g;

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockPattern.exec(projectOnly)) !== null) {
    const block = blockMatch[1];
    const groupId = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1];
    const artifactId = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1];
    const version = block.match(/<version>([^<]+)<\/version>/)?.[1];
    const scope = block.match(/<scope>([^<]+)<\/scope>/)?.[1];

    if (!groupId || !artifactId) continue;

    dependencies.push({
      name: `${groupId}:${artifactId}`,
      versionRange: resolveVersion(version),
      kind: scope === "test" ? "dev" : "runtime",
    });
  }

  return dependencies;
}

/** Collects the <properties> section of a pom.xml into a key->value map. */
function extractMavenProperties(content: string): Record<string, string> {
  const properties: Record<string, string> = {};
  const section = content.match(/<properties>([\s\S]*?)<\/properties>/);
  if (!section) return properties;

  const entryPattern = /<([A-Za-z0-9_.-]+)>([^<]+)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = entryPattern.exec(section[1])) !== null) {
    properties[match[1]] = match[2];
  }
  return properties;
}

export const parseGradle_: ManifestParser = {
  // build.gradle (Groovy DSL, single-quoted strings) and build.gradle.kts
  // (Kotlin DSL, double-quoted function calls) share the same
  // group:artifact:version dependency syntax — one parser, two filenames.
  filename: ["build.gradle", "build.gradle.kts"],
  parse: parseGradle,
};

export const parsePom: ManifestParser = {
  filename: "pom.xml",
  parse: parseMaven,
};
