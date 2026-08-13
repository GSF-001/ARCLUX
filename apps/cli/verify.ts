// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// LAB 2 MVP — combines existing detectors (the same 10 core detectors
// doctor.ts also runs — this is the deliberate PASS/FAIL subset; the 8
// convention/usage detectors doctor.ts runs on top are informational, so
// they don't flip verify's verdict) with the rule engine
// (packages/rules/RuleEngine.ts) into a single PASS/FAIL verdict.
//
// Rule coverage, confirmed by direct inspection (2026-08-11), NOT
// assumed: of 13 rule files across nextjs/react/nestjs/express/vite/
// electron, only packages/rules/nextjs/requirePage.ts has a real
// implementation (60 lines). The other 12 are copyright-header-only
// stubs (8 lines, no `export` statement at all) — importing any of
// them would fail at compile time. Do NOT add them to `rules` below
// until they're actually implemented. This file only wires up
// requirePage on purpose, not by oversight.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeRepository } from "../../packages/engine/pipeline";
import { detectCircularDependency } from "../../packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "../../packages/detectors/detectUnusedExports";
import { detectOrphanFiles } from "../../packages/detectors/detectOrphanFiles";
import { detectLargeModules } from "../../packages/detectors/detectLargeModules";
import { detectDuplicateModules } from "../../packages/detectors/detectDuplicateModules";
import { detectSharedModules } from "../../packages/detectors/detectSharedModules";
import { detectIndexFiles } from "../../packages/detectors/detectIndexFiles";
import { detectLayerViolation } from "../../packages/detectors/detectLayerViolation";
import { detectDeadCode } from "../../packages/detectors/detectDeadCode";
import { detectAmbiguousSymbolResolution } from "../../packages/detectors/detectAmbiguousSymbolResolution";
import { runRules } from "../../packages/rules/RuleEngine";
import { requirePage } from "../../packages/rules/nextjs/requirePage";

export function registerVerifyCommand(program: Command): void {
  program
    .command("verify")
    .description("Run detectors + framework rules and give a single PASS/FAIL verdict")
    .argument("[path]", "path to the repository root", ".")
    .action(async (targetPath: string) => {
      const spinner = p.spinner();
      spinner.start(`Verifying ${targetPath}`);

      try {
        const { repository, meta } = await analyzeRepository({ localPath: targetPath });

        // Same 10 detectors doctor.ts runs (detectEntryPoints excluded on
        // purpose here too — it's informational, not a pass/fail signal).
        const cycles = detectCircularDependency(repository);
        const unusedExports = detectUnusedExports(repository);
        const orphanFiles = detectOrphanFiles(repository);
        const largeModules = detectLargeModules(repository);
        const duplicateModules = detectDuplicateModules(repository);
        const sharedModules = detectSharedModules(repository);
        const indexFiles = detectIndexFiles(repository);
        const layerViolations = detectLayerViolation(repository);
        const deadCode = detectDeadCode(repository);
        const ambiguousSymbols = detectAmbiguousSymbolResolution(repository);

        const detectorTotal =
          cycles.length +
          unusedExports.length +
          orphanFiles.length +
          largeModules.length +
          duplicateModules.length +
          sharedModules.length +
          indexFiles.length +
          layerViolations.length +
          deadCode.length +
          ambiguousSymbols.length;

        // Rule engine — see file header: only requirePage is real right now.
        const ruleViolations = runRules(repository, [requirePage], meta.detectedFrameworks);
        const ruleErrors = ruleViolations.filter((v) => v.severity === "error");
        const ruleWarnings = ruleViolations.filter((v) => v.severity === "warning");

        spinner.stop("Verification finished");

        p.log.info(`Detectors: ${detectorTotal} issue(s) across 10 checks`);
        p.log.info(
          `Rules: ${ruleViolations.length} violation(s) (${ruleErrors.length} error, ${ruleWarnings.length} warning) — frameworks checked: ${meta.detectedFrameworks.join(", ") || "none detected"}`
        );

        if (ruleViolations.length > 0) {
          for (const v of ruleViolations) {
            p.log.message(`  [${v.severity}] ${v.filePath} (${v.ruleId}) \u2014 ${v.message}`);
          }
        }

        // PASS/FAIL verdict: any detector finding OR any rule error fails.
        // Rule *warnings* alone don't fail the build (matches severity
        // semantics already defined in RuleViolation) but are still shown
        // above so they're not silently dropped.
        const failed = detectorTotal > 0 || ruleErrors.length > 0;

        if (failed) {
          p.log.error(`FAIL \u2014 ${detectorTotal} detector issue(s), ${ruleErrors.length} rule error(s)`);
        } else {
          p.log.success("PASS \u2014 no detector issues, no rule errors");
        }

        process.exitCode = failed ? 1 : 0;
      } catch (err) {
        spinner.stop("Verification failed to run");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
