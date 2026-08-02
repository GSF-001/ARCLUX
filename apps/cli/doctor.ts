// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Runs every detector that currently exists (7 of 18 — see PROGRES.md).
//
// Still calling each directly rather than via a registry. With 7 of these
// blocks the file is getting long, and a registry (detector -> run + print
// adapter) is worth doing soon — but each detector's finding shape is
// genuinely different (cycle vs filePath+line vs hash+filePaths[] vs
// isPureBarrel, etc.), so a registry here needs a print-adapter per
// detector, not just a list of functions. Deferred rather than done half-
// right in this pass; revisit once detector #8+ makes this file painful.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeLocalDirectory } from "./analyzeLocal";
import { detectCircularDependency } from "../../packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "../../packages/detectors/detectUnusedExports";
import { detectOrphanFiles } from "../../packages/detectors/detectOrphanFiles";
import { detectLargeModules } from "../../packages/detectors/detectLargeModules";
import { detectDuplicateModules } from "../../packages/detectors/detectDuplicateModules";
import { detectSharedModules } from "../../packages/detectors/detectSharedModules";
import { detectIndexFiles } from "../../packages/detectors/detectIndexFiles";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Run all available detectors against a local repository (7/18 implemented so far)")
    .argument("[path]", "path to the repository root", ".")
    .action(async (targetPath: string) => {
      const spinner = p.spinner();
      spinner.start(`Running detectors on ${targetPath}`);

      try {
        const { repository } = await analyzeLocalDirectory(targetPath);
        spinner.stop("Detectors finished");

        const cycles = detectCircularDependency(repository);
        const unusedExports = detectUnusedExports(repository);
        const orphanFiles = detectOrphanFiles(repository);
        const largeModules = detectLargeModules(repository);
        const duplicateModules = detectDuplicateModules(repository);
        const sharedModules = detectSharedModules(repository);
        const indexFiles = detectIndexFiles(repository);

        const total =
          cycles.length +
          unusedExports.length +
          orphanFiles.length +
          largeModules.length +
          duplicateModules.length +
          sharedModules.length +
          indexFiles.length;

        if (total === 0) {
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
            "  (note: entry files aren't detected yet \u2014 resolveRoutes.ts is empty \u2014 so an app's entry point may show up here as a false positive)"
          );
          for (const f of unusedExports) {
            p.log.message(`  ${f.filePath}:${f.line} \u2014 ${f.message}`);
          }
        }

        if (orphanFiles.length > 0) {
          p.log.warn(`${orphanFiles.length} orphan ${orphanFiles.length === 1 ? "file" : "files"} found:`);
          p.log.message(
            "  (note: same entry-file caveat as unused exports \u2014 a genuine entry point can show up here)"
          );
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

        process.exitCode = 1;
      } catch (err) {
        spinner.stop("Detectors failed to run");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
