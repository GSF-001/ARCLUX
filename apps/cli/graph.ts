// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Command } from "commander";
import { writeFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { analyzeLocalDirectory } from "./analyzeLocal";

export function registerGraphCommand(program: Command): void {
  program
    .command("graph")
    .description("Build the dependency graph for a local repository and print or save it as JSON")
    .argument("[path]", "path to the repository root", ".")
    .option("-o, --output <file>", "write the graph as JSON to this file instead of printing a summary")
    .action(async (targetPath: string, options: { output?: string }) => {
      const spinner = p.spinner();
      spinner.start(`Building graph for ${targetPath}`);
      try {
        const { graph } = await analyzeLocalDirectory(targetPath);
        spinner.stop("Graph built");

        if (options.output) {
          writeFileSync(options.output, JSON.stringify(graph, null, 2), "utf-8");
          p.log.success(`Graph written to ${options.output}`);
        } else {
          p.log.info(`${graph.nodes.length} nodes, ${graph.edges.length} edges`);
          for (const node of graph.nodes) {
            p.log.message(`  [${node.type}] ${node.label}`);
          }
        }
      } catch (err) {
        spinner.stop("Graph build failed");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
