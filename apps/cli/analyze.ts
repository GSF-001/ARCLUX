// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeRepository } from "../../packages/engine/pipeline";
import { detectCircularDependency } from "../../packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "../../packages/detectors/detectUnusedExports";
import { detectOrphanFiles } from "../../packages/detectors/detectOrphanFiles";
import { detectLayerViolation } from "../../packages/detectors/detectLayerViolation";
import type { Repository } from "../../packages/repository/Repository";

export interface DetectorSummary {
  circular: number;
  unusedExports: number;
  orphanFiles: number;
  layerViolations: number;
  total: number;
}

/**
 * Headline detector counts shown by `arclux analyze` — the four categories
 * issue #261 asked the demo to surface (circular deps, unused exports,
 * layer violations) plus orphan files. Extracted as a pure function so the
 * summary logic is unit-testable without driving the CLI.
 */
export function summarizeDetectors(repository: Repository): DetectorSummary {
  const circular = detectCircularDependency(repository).length;
  const unusedExports = detectUnusedExports(repository).length;
  const orphanFiles = detectOrphanFiles(repository).length;
  const layerViolations = detectLayerViolation(repository).length;
  return {
    circular,
    unusedExports,
    orphanFiles,
    layerViolations,
    total: circular + unusedExports + orphanFiles + layerViolations,
  };
}

export function registerAnalyzeCommand(program: Command): void {
  program
    .command("analyze")
    .description("Analyze a local repository: parse, index, build dependency graph")
    .argument("[path]", "path to the repository root", ".")
    .action(async (targetPath: string) => {
      const spinner = p.spinner();
      spinner.start(`Analyzing ${targetPath}`);
      const startedAt = Date.now();
      try {
        const { repository, meta, graph, scanSummary } = await analyzeRepository({ localPath: targetPath });
        const elapsedMs = Date.now() - startedAt;
        spinner.stop("Analysis complete");

        p.log.info(`Repository: ${meta.name}`);
        p.log.info(`Frameworks: ${meta.detectedFrameworks.join(", ") || "none detected"}`);
        p.log.info(`Package manager: ${meta.packageManager}`);
        p.log.success(`${repository.moduleCount} modules indexed`);
        p.log.info(
          `Scan: ${result.scanSummary.filesScanned} files, ${result.scanSummary.filesParsed} parsed, ${result.scanSummary.filesSkippedNoParser} skipped (no parser)`
        );
        p.log.success(`${graph.nodes.length} nodes, ${graph.edges.length} edges in dependency graph`);

        const summary = summarizeDetectors(repository);
        // Kept short enough to fit one terminal line at the demo width — a
        // wrapped summary line pushes later output past the buffer window
        // VHS's Wait+Screen reads (see assets/demo.tape).
        p.log.info(
          `Detectors: ${summary.total} issue${summary.total === 1 ? "" : "s"} \u2014 circular ${summary.circular}, unused ${summary.unusedExports}, orphan ${summary.orphanFiles}, layer ${summary.layerViolations}`
        );
        p.log.info(`Elapsed: ${(elapsedMs / 1000).toFixed(2)}s`);
      } catch (err) {
        spinner.stop("Analysis failed");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
