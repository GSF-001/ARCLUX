// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeLocalDirectory } from "./analyzeLocal";

export function registerAnalyzeCommand(program: Command): void {
  program
    .command("analyze")
    .description("Analyze a local repository: parse, index, build dependency graph")
    .argument("[path]", "path to the repository root", ".")
    .action(async (targetPath: string) => {
      const spinner = p.spinner();
      spinner.start(`Analyzing ${targetPath}`);
      try {
        const { repository, meta, graph } = await analyzeLocalDirectory(targetPath);
        spinner.stop("Analysis complete");

        p.log.info(`Repository: ${meta.name}`);
        p.log.info(`Frameworks: ${meta.detectedFrameworks.join(", ") || "none detected"}`);
        p.log.info(`Package manager: ${meta.packageManager}`);
        p.log.success(`${repository.moduleCount} modules indexed`);
        p.log.success(`${graph.nodes.length} nodes, ${graph.edges.length} edges in dependency graph`);
      } catch (err) {
        spinner.stop("Analysis failed");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
