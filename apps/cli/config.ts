// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Only reports what's auto-detected right now (frameworks, package
// manager) — there is no .arcluxrc / config file schema yet
// (packages/shared/config.ts is still an empty stub). Once that exists,
// this command should read/print the actual config file instead.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeLocalDirectory } from "./analyzeLocal";

export function registerConfigCommand(program: Command): void {
  program
    .command("config")
    .description("Show auto-detected repository metadata (no config file support yet)")
    .argument("[path]", "path to the repository root", ".")
    .action(async (targetPath: string) => {
      try {
        const { meta } = await analyzeLocalDirectory(targetPath);
        p.log.info(`name: ${meta.name}`);
        p.log.info(`frameworks: ${meta.detectedFrameworks.join(", ") || "none detected"}`);
        p.log.info(`packageManager: ${meta.packageManager}`);
        p.log.info(`rootPath: ${meta.rootPath}`);
      } catch (err) {
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
