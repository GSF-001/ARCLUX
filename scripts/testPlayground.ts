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

import path from "node:path";
import { buildIndex } from "../packages/indexer/buildIndex";
import { buildDependencyGraph } from "../packages/graph/buildDependencyGraph";
import { detectCircularDependency } from "../packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "../packages/detectors/detectUnusedExports";
import { parserRegistry } from "../packages/parser/core/ParserRegistry";
import { parseTs } from "../packages/parser/typescript/parseTs";
import { parsePython } from "../packages/parser/python/parsePython";
import type { RepositoryMeta } from "../packages/shared/types";

parserRegistry.register(parseTs);
parserRegistry.register(parsePython);

async function main() {
  const fixtureName = process.argv[2];
  if (!fixtureName) {
    console.error("Usage: npx tsx scripts/testPlayground.ts <fixture-name>");
    process.exit(1);
  }

  const rootPath = path.resolve(__dirname, "..", "playground", fixtureName);
  console.log(`\n=== Analyzing playground/${fixtureName} ===\n`);

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

  for (const module of repository.getAllModules()) {
    console.log(
      `  - ${module.id} (${module.exports.length} exports, imports: [${module.imports.join(", ")}])`
    );
  }

  const graph = buildDependencyGraph(repository);
  console.log(`\nGraph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  console.log("\n--- detectCircularDependency ---");
  const cycles = detectCircularDependency(repository);
  if (cycles.length === 0) {
    console.log("No cycles found.");
  } else {
    for (const cycle of cycles) {
      console.log(JSON.stringify(cycle));
    }
  }

  console.log("\n--- detectUnusedExports ---");
  const unused = detectUnusedExports(repository);
  if (unused.length === 0) {
    console.log("No unused exports found.");
  } else {
    for (const finding of unused) {
      console.log(`  ${finding.filePath}:${finding.line} — ${finding.message}`);
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
