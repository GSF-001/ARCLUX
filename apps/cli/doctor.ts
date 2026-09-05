// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Runs every detector that currently exists (all 19 — see the import list
// below). Each detector takes (repository: Repository) => Finding[] and is
// added to `total` / the exit code the same way.
//
// Note: the 10 detectors wired into verify.ts are the PASS/FAIL gate;
// the 8 convention/usage detectors added here (component/feature/route/
// story/test conventions, repository pattern, missing exports, unused
// files) are informational in the same sense detectEntryPoints is — they
// report structural signals without flipping verify's verdict.
//
// Note: detectEntryPoints findings will legitimately overlap with
// detectOrphanFiles findings — an entry point IS an orphan by definition
// (nothing imports it), it's just a recognized-as-intentional one. That
// duplication in the printed output is expected, not a bug — the two
// detectors answer different questions ("is this ever imported" vs "is
// this orphan actually a known entry-point convention").

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeRepository } from "../../packages/engine/pipeline";
import { getHeadState, reportFreshness } from "../../packages/git/headFreshness";
import { detectCircularDependency } from "../../packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "../../packages/detectors/detectUnusedExports";
import { detectOrphanFiles } from "../../packages/detectors/detectOrphanFiles";
import { detectLargeModules } from "../../packages/detectors/detectLargeModules";
import { detectDuplicateModules } from "../../packages/detectors/detectDuplicateModules";
import { detectSharedModules } from "../../packages/detectors/detectSharedModules";
import { detectIndexFiles } from "../../packages/detectors/detectIndexFiles";
import { detectLayerViolation } from "../../packages/detectors/detectLayerViolation";
import { detectDeadCode } from "../../packages/detectors/detectDeadCode";
import { detectEntryPoints } from "../../packages/detectors/detectEntryPoints";
import { detectAmbiguousSymbolResolution } from "../../packages/detectors/detectAmbiguousSymbolResolution";
import { detectComponentConvention } from "../../packages/detectors/detectComponentConvention";
import { detectFeatureStructure } from "../../packages/detectors/detectFeatureStructure";
import { detectMissingExports } from "../../packages/detectors/detectMissingExports";
import { detectRepositoryPattern } from "../../packages/detectors/detectRepositoryPattern";
import { detectRouteConvention } from "../../packages/detectors/detectRouteConvention";
import { detectStoryConvention } from "../../packages/detectors/detectStoryConvention";
import { detectTestConvention } from "../../packages/detectors/detectTestConvention";
import { detectUnusedFiles } from "../../packages/detectors/detectUnusedFiles";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Run all available detectors against a local repository (10/18 implemented so far)")
    .argument("[path]", "path to the repository root", ".")
    .action(async (targetPath: string) => {
      const spinner = p.spinner();
      spinner.start(`Running detectors on ${targetPath}`);

      try {
        const { repository, meta } = await analyzeRepository({ localPath: targetPath });
        spinner.stop("Detectors finished");

        // Freshness lamp: the analysis was just built, so this reports its
        // anchor (HEAD/clean) — STALE here means "built on a dirty tree",
        // explained, not alarming. Held/cached results are checked by
        // readers via evaluateFreshness, not here.
        const fresh = reportFreshness(meta.buildHead ?? null, await getHeadState(meta.rootPath));
        if (fresh.verdict === "FRESH") p.log.success(`Analysis fresh \u2014 ${fresh.detail}`);
        else if (fresh.verdict === "STALE") p.log.warn(`Analysis anchor: STALE \u2014 ${fresh.detail}`);
        else p.log.info(`Analysis anchor: INCONCLUSIVE \u2014 ${fresh.detail}`);

        const cycles = detectCircularDependency(repository);
        const unusedExports = detectUnusedExports(repository);
        const orphanFiles = detectOrphanFiles(repository);
        const largeModules = detectLargeModules(repository);
        const duplicateModules = detectDuplicateModules(repository);
        const sharedModules = detectSharedModules(repository);
        const indexFiles = detectIndexFiles(repository);
        const layerViolations = detectLayerViolation(repository);
        const deadCode = detectDeadCode(repository);
        const entryPoints = detectEntryPoints(repository);
        const ambiguousSymbols = detectAmbiguousSymbolResolution(repository);
        const componentConvention = detectComponentConvention(repository);
        const featureStructure = detectFeatureStructure(repository);
        const missingExports = detectMissingExports(repository);
        const repositoryPattern = detectRepositoryPattern(repository);
        const routeConvention = detectRouteConvention(repository);
        const storyConvention = detectStoryConvention(repository);
        const testConvention = detectTestConvention(repository);
        const unusedFiles = detectUnusedFiles(repository);

        const total =
          cycles.length +
          unusedExports.length +
          orphanFiles.length +
          largeModules.length +
          duplicateModules.length +
          sharedModules.length +
          indexFiles.length +
          layerViolations.length +
          deadCode.length +
          ambiguousSymbols.length +
          componentConvention.length +
          featureStructure.length +
          missingExports.length +
          repositoryPattern.length +
          routeConvention.length +
          storyConvention.length +
          testConvention.length +
          unusedFiles.length;
        // entryPoints intentionally excluded from `total` / exit code —
        // it's informational (confirms known-good files), not an issue.

        if (total === 0 && entryPoints.length === 0) {
          p.log.success("No issues found.");
          return;
        }

        if (cycles.length > 0) {
          p.log.warn(`${cycles.length} circular ${cycles.length === 1 ? "dependency" : "dependencies"} found:`);
          for (const c of cycles) {
            p.log.message(`  ${c.cycle.join(" \u2192 ")}`);
          }
        }

        if (unusedExports.length > 0) {
          p.log.warn(`${unusedExports.length} unused ${unusedExports.length === 1 ? "export" : "exports"} found:`);
          p.log.message(
            "  (entry points are filtered out \u2014 App Router files and CLI entry are excluded as false-positive class)"
          );
          for (const f of unusedExports) {
            p.log.message(`  ${f.filePath}:${f.line} \u2014 ${f.message}`);
          }
        }

        if (orphanFiles.length > 0) {
          p.log.warn(`${orphanFiles.length} orphan ${orphanFiles.length === 1 ? "file" : "files"} found:`);
          p.log.message("  (entry points are filtered out \u2014 same exclusion as unused exports)");
          for (const f of orphanFiles) {
            p.log.message(`  ${f.filePath} \u2014 ${f.message}`);
          }
        }

        if (largeModules.length > 0) {
          p.log.warn(`${largeModules.length} large ${largeModules.length === 1 ? "module" : "modules"} found:`);
          for (const f of largeModules) {
            p.log.message(`  ${f.filePath} (${f.sizeBytes.toLocaleString()} bytes)`);
          }
        }

        if (duplicateModules.length > 0) {
          p.log.warn(
            `${duplicateModules.length} duplicate module ${duplicateModules.length === 1 ? "group" : "groups"} found:`
          );
          for (const g of duplicateModules) {
            p.log.message(`  ${g.filePaths.join(", ")} (${g.sizeBytes.toLocaleString()} bytes each)`);
          }
        }

        if (sharedModules.length > 0) {
          p.log.warn(
            `${sharedModules.length} widely-shared ${sharedModules.length === 1 ? "module" : "modules"} found (informational, not necessarily a problem):`
          );
          for (const f of sharedModules) {
            p.log.message(`  ${f.filePath} \u2014 ${f.message}`);
          }
        }

        if (indexFiles.length > 0) {
          const mixed = indexFiles.filter((f) => !f.isPureBarrel);
          p.log.warn(`${indexFiles.length} index ${indexFiles.length === 1 ? "file" : "files"} found:`);
          if (mixed.length > 0) {
            p.log.message(`  ${mixed.length} mix re-exports with their own definitions:`);
            for (const f of mixed) {
              p.log.message(`    ${f.filePath} \u2014 ${f.message}`);
            }
          }
        }

        if (layerViolations.length > 0) {
          p.log.warn(
            `${layerViolations.length} layer ${layerViolations.length === 1 ? "violation" : "violations"} found:`
          );
          for (const f of layerViolations) {
            p.log.message(`  ${f.filePath}:${f.line} \u2192 ${f.importedFilePath} [${f.ruleName}] \u2014 ${f.message}`);
          }
        }

        if (deadCode.length > 0) {
          p.log.warn(`${deadCode.length} dead code ${deadCode.length === 1 ? "candidate" : "candidates"} found:`);
          for (const f of deadCode) {
            p.log.message(`  ${f.filePath} \u2014 ${f.message}`);
          }
        }

        if (ambiguousSymbols.length > 0) {
          p.log.warn(
            `${ambiguousSymbols.length} ambiguous ${ambiguousSymbols.length === 1 ? "symbol" : "symbols"} found (same name resolves to multiple definitions):`
          );
          for (const f of ambiguousSymbols) {
            p.log.message(`  [${f.severity}] ${f.symbolName} \u2014 ${f.reason}`);
            for (const d of f.definitions) {
              p.log.message(`    ${d.modulePath}:${d.line} (${d.category})`);
            }
          }
        }

        const conventionFindings = [
          ["component convention", componentConvention],
          ["feature-structure", featureStructure],
          ["missing-export", missingExports],
          ["repository-pattern", repositoryPattern],
          ["route convention", routeConvention],
          ["story convention", storyConvention],
          ["test convention", testConvention],
          ["unused-file", unusedFiles],
        ] as const;
        for (const [label, findings] of conventionFindings) {
          if (findings.length > 0) {
            p.log.warn(`${findings.length} ${label} ${findings.length === 1 ? "issue" : "issues"} found:`);
            for (const f of findings) {
              const location =
                "filePath" in f
                  ? f.filePath
                  : "featurePath" in f
                    ? f.featurePath
                    : "cycle" in f
                      ? f.cycle.join(" \u2192 ")
                      : "";
              p.log.message(`  ${location} \u2014 ${f.message}`);
            }
          }
        }

        if (entryPoints.length > 0) {
          p.log.info(
            `${entryPoints.length} recognized entry ${entryPoints.length === 1 ? "point" : "points"} (informational \u2014 not an issue, listed to help cross-check the findings above):`
          );
          for (const f of entryPoints) {
            p.log.message(`  ${f.filePath} \u2014 ${f.reason}`);
          }
        }

        process.exitCode = total > 0 ? 1 : 0;
      } catch (err) {
        spinner.stop("Detectors failed to run");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
