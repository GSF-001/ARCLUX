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
import { detectDeadCode } from "../packages/detectors/detectDeadCode";
import { detectLayerViolation } from "../packages/detectors/detectLayerViolation";
import { detectAmbiguousSymbolResolution } from "../packages/detectors/detectAmbiguousSymbolResolution";
import type { Repository } from "../packages/repository/Repository";
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

  // Real-repo detector score: every detector must run without throwing and
  // return an array of objects. Findings are informational — exit code 1 is
  // reserved for crashes / malformed output (catches the class of bugs
  // synthetic fixtures miss, e.g. the 263-byte stub duplicate-modules
  // incident, status-detectors.md 2026-08-03).
  const DETECTORS: {
    name: string;
    run: (r: Repository) => unknown[];
    format: (f: unknown) => string;
  }[] = [
    { name: "detectCircularDependency", run: detectCircularDependency, format: (c) => JSON.stringify(c) },
    { name: "detectUnusedExports", run: detectUnusedExports, format: (f) => `${(f as { filePath: string }).filePath}:${(f as { line: number }).line} — ${(f as { message: string }).message}` },
    { name: "detectOrphanFiles", run: detectOrphanFiles, format: (f) => (f as { message: string }).message },
    { name: "detectDeadCode", run: detectDeadCode, format: (f) => (f as { message: string }).message },
    { name: "detectLargeModules", run: detectLargeModules, format: (f) => (f as { message: string }).message },
    { name: "detectDuplicateModules", run: detectDuplicateModules, format: (g) => `[${(g as { filePaths: string[] }).filePaths.join(", ")}]` },
    { name: "detectSharedModules", run: detectSharedModules, format: (f) => (f as { message: string }).message },
    { name: "detectIndexFiles", run: detectIndexFiles, format: (f) => (f as { message: string }).message },
    { name: "detectLayerViolation", run: detectLayerViolation, format: (f) => { const x = f as { ruleName: string; importedFilePath: string; line: number }; return `${x.ruleName} → ${x.importedFilePath}:${x.line}`; } },
    { name: "detectEntryPoints", run: detectEntryPoints, format: (f) => `${(f as { filePath: string }).filePath} — ${(f as { reason: string }).reason}` },
    { name: "detectUnusedFiles", run: detectUnusedFiles, format: (f) => (f as { message: string }).message },
    { name: "detectComponentConvention", run: detectComponentConvention, format: (f) => (f as { message: string }).message },
    { name: "detectRouteConvention", run: detectRouteConvention, format: (f) => (f as { message: string }).message },
    { name: "detectTestConvention", run: detectTestConvention, format: (f) => (f as { message: string }).message },
    { name: "detectStoryConvention", run: detectStoryConvention, format: (f) => (f as { message: string }).message },
    { name: "detectMissingExports", run: detectMissingExports, format: (f) => (f as { message: string }).message },
    { name: "detectFeatureStructure", run: detectFeatureStructure, format: (f) => (f as { message: string }).message },
    { name: "detectRepositoryPattern", run: detectRepositoryPattern, format: (f) => JSON.stringify(f) },
    { name: "detectAmbiguousSymbolResolution", run: detectAmbiguousSymbolResolution, format: (f) => { const x = f as { symbolName: string; severity: string }; return `${x.symbolName} (${x.severity})`; } },
  ];

  const failures: string[] = [];
  for (const entry of DETECTORS) {
    try {
      const findings = entry.run(repository);
      if (
        !Array.isArray(findings) ||
        findings.some((item) => typeof item !== "object" || item === null)
      ) {
        failures.push(`${entry.name}: malformed output (expected array of objects)`);
        continue;
      }
      printList(entry.name, findings as object[], entry.format);
    } catch (err) {
      failures.push(`${entry.name}: threw ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const ok = DETECTORS.length - failures.length;
  console.log(`\n=== Detector score (real repo): ${ok}/${DETECTORS.length} OK ===`);
  if (failures.length > 0) {
    console.error("FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log("");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
