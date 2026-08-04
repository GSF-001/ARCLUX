// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { parseGoMod } from "../packages/parser/go/parseGoMod";
import { parseCargoToml } from "../packages/parser/rust/parseCargoToml";
import { parseComposer } from "../packages/parser/php/parseComposer";
import { parseGemfile } from "../packages/parser/ruby/parseGemfile";
import { parsePom } from "../packages/parser/java/parseGradlePom";
import type { ManifestParser, ManifestDependency } from "../packages/parser/core/ManifestParserInterface";

const SAMPLES_DIR = join(homedir(), "manifest-samples");

function run(label: string, filename: string, parser: ManifestParser) {
  const filePath = join(SAMPLES_DIR, filename);
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.log(`\n--- ${label} (${filename}) ---`);
    console.log(`SKIPPED — file not found at ${filePath}`);
    return;
  }

  const deps = parser.parse(content);
  console.log(`\n--- ${label} (${filename}) — ${deps.length} dependencies ---`);
  const runtime = deps.filter((d: ManifestDependency) => d.kind === "runtime");
  const dev = deps.filter((d: ManifestDependency) => d.kind === "dev");
  console.log(`  runtime: ${runtime.length}, dev: ${dev.length}`);
  for (const dep of deps) {
    console.log(`  [${dep.kind}] ${dep.name}${dep.versionRange ? ` @ ${dep.versionRange}` : ""}`);
  }
}

run("Go (gin)", "go.mod", parseGoMod);
run("Rust (tokio)", "Cargo.toml", parseCargoToml);
run("PHP (laravel)", "composer.json", parseComposer);
run("Ruby (rails)", "Gemfile", parseGemfile);
run("Java/Maven (spring-petclinic)", "pom.xml", parsePom);
