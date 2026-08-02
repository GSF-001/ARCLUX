// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Runs every detector that currently exists (2 of 18 — see PROGRES.md).
// There is no detector registry yet (unlike parserRegistry) — with only 2
// detectors, calling each directly here is fine. Worth introducing a
// registry once there are more than a handful, to avoid this file growing
// an import + call site for each of the other 16.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeLocalDirectory } from "./analyzeLocal";
import { detectCircularDependency } from "../../packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "../../packages/detectors/detectUnusedExports";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Run all available detectors against a local repository (2/18 implemented so far)")
    .argument("[path]", "path to the repository root", ".")
    .action(async (targetPath: string) => {
      const spinner = p.spinner();
      spinner.start(`Running detectors on ${targetPath}`);
      try {
        const { repository } = await analyzeLocalDirectory(targetPath);
        spinner.stop("Detectors finished");

        const cycles = detectCircularDependency(repository);
        const unusedExports = detectUnusedExports(repository);
        const total = cycles.length + unusedExports.length;

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

        process.exitCode = 1;
      } catch (err) {
        spinner.stop("Detectors failed to run");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
