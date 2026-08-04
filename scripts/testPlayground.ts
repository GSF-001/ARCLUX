// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Manual verification script — runs the pipeline's individual steps
// (buildIndex, buildDependencyGraph, detectors) directly against a local
// playground/ fixture, bypassing analyzeRepository()'s clone/cleanup
// lifecycle since that's designed for remote repoUrl, not local paths.
// This is the documented exception to "don't call individual steps
// outside engine/" — that rule is for production call sites (CLI, API
// routes), not local verification scripts like this one.
//
// Run with: npx tsx scripts/testPlayground.ts <fixture-name>
// Example:  npx tsx scripts/testPlayground.ts python-demo
// Example:  npx tsx scripts/testPlayground.ts . --local   (analyze ARCLUX itself)

import path from "node:path";
import { buildIndex } from "../packages/indexer/buildIndex";
import { buildDependencyGraph } from "../packages/graph/buildDependencyGraph";
import { detectCircularDependency } from "../packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "../packages/detectors/detectUnusedExports";
import { detectOrphanFiles } from "../packages/detectors/detectOrphanFiles";
import { detectLargeModules } from "../packages/detectors/detectLargeModules";
import { detectDuplicateModules } from "../packages/detectors/detectDuplicateModules";
import { detectSharedModules } from "../packages/detectors/detectSharedModules";
import { detectIndexFiles } from "../packages/detectors/detectIndexFiles";
import { detectEntryPoints } from "../packages/detectors/detectEntryPoints";
import { detectUnusedFiles } from "../packages/detectors/detectUnusedFiles";
import { detectComponentConvention } from "../packages/detectors/detectComponentConvention";
import { detectRouteConvention } from "../packages/detectors/detectRouteConvention";
import { detectTestConvention } from "../packages/detectors/detectTestConvention";
import { detectStoryConvention } from "../packages/detectors/detectStoryConvention";
import { detectMissingExports } from "../packages/detectors/detectMissingExports";
import { detectFeatureStructure } from "../packages/detectors/detectFeatureStructure";
import { detectRepositoryPattern } from "../packages/detectors/detectRepositoryPattern";
import { parserRegistry } from "../packages/parser/core/ParserRegistry";
import { parseTs } from "../packages/parser/typescript/parseTs";
import { parsePython } from "../packages/parser/python/parsePython";
import { parseJs } from "../packages/parser/javascript/parseJs";
import { parseJsx } from "../packages/parser/javascript/parseJsx";
import { parseCommonJs } from "../packages/parser/javascript/parseCommonJs";
import { parseGo } from "../packages/parser/go/parseGo";
import { parseJava } from "../packages/parser/java/parseJava";
import type { RepositoryMeta } from "../packages/shared/types";

parserRegistry.register(parseTs);
parserRegistry.register(parsePython);
parserRegistry.register(parseJs);
parserRegistry.register(parseJsx);
parserRegistry.register(parseCommonJs);
parserRegistry.register(parseGo);
parserRegistry.register(parseJava);

function printList<T>(label: string, items: T[], format: (item: T) => string) {
  console.log(`\n--- ${label} ---`);
  if (items.length === 0) {
    console.log("No findings.");
    return;
  }
  for (const item of items) {
    console.log(`  ${format(item)}`);
  }
}

async function main() {
  const fixtureName = process.argv[2];
  if (!fixtureName) {
    console.error("Usage: npx tsx scripts/testPlayground.ts <fixture-name>");
    process.exit(1);
  }

  const rootPath =
    fixtureName === "."
      ? path.resolve(__dirname, "..")
      : path.resolve(__dirname, "..", "playground", fixtureName);

  console.log(`\n=== Analyzing ${fixtureName === "." ? "ARCLUX itself" : `playground/${fixtureName}`} ===\n`);

  const meta: RepositoryMeta = {
    id: "local-test",
    org: "local",
    name: fixtureName,
    defaultBranch: "main",
    rootPath,
    detectedFrameworks: [],
    packageManager: "unknown",
    analyzedAt: new Date().toISOString(),
  };

  const repository = await buildIndex({ rootPath, meta });
  console.log(`Modules indexed: ${repository.moduleCount}`);

  const graph = buildDependencyGraph(repository);
  console.log(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  printList("detectCircularDependency", detectCircularDependency(repository), (c) => JSON.stringify(c));
  printList("detectUnusedExports", detectUnusedExports(repository), (f) => `${f.filePath}:${f.line} — ${f.message}`);
  printList("detectOrphanFiles", detectOrphanFiles(repository), (f) => f.message);
  printList("detectLargeModules", detectLargeModules(repository), (f) => f.message);
  printList("detectDuplicateModules", detectDuplicateModules(repository), (g) => `[${g.filePaths.join(", ")}]`);
  printList("detectSharedModules", detectSharedModules(repository), (f) => f.message);
  printList("detectIndexFiles", detectIndexFiles(repository), (f) => f.message);
  printList("detectEntryPoints", detectEntryPoints(repository), (f) => `${f.filePath} — ${f.reason}`);
  printList("detectUnusedFiles", detectUnusedFiles(repository), (f) => f.message);
  printList("detectComponentConvention", detectComponentConvention(repository), (f) => f.message);
  printList("detectRouteConvention", detectRouteConvention(repository), (f) => f.message);
  printList("detectTestConvention", detectTestConvention(repository), (f) => f.message);
  printList("detectStoryConvention", detectStoryConvention(repository), (f) => f.message);
  printList("detectMissingExports", detectMissingExports(repository), (f) => f.message);
  printList("detectFeatureStructure", detectFeatureStructure(repository), (f) => f.message);
  printList("detectRepositoryPattern", detectRepositoryPattern(repository), (f) => f.message);

  console.log("");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
