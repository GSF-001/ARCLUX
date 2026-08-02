// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// CORRECTED: this command used to report itself as unimplemented, but
// packages/impact/* turned out to be fully implemented (8/8 files) from
// an earlier commit that PROGRES.md hadn't caught up with yet — see the
// "KOREKSI PENTING" entry in PROGRES.md for how that was discovered.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeLocalDirectory } from "./analyzeLocal";
import { traceConsumers } from "../../packages/impact/traceConsumers";
import { traceDependencies } from "../../packages/impact/traceDependencies";
import { calculateAffectedFiles } from "../../packages/impact/calculateAffectedFiles";

export function registerImpactCommand(program: Command): void {
  program
    .command("impact")
    .description("Show what's affected if a given file changes")
    .argument("<file>", "path to the file, relative to the repository root (e.g. src/utils.ts)")
    .argument("[repoPath]", "path to the repository root", ".")
    .action(async (file: string, repoPath: string) => {
      const spinner = p.spinner();
      spinner.start(`Analyzing impact of ${file}`);
      try {
        const { repository } = await analyzeLocalDirectory(repoPath);

        if (!repository.getModule(file)) {
          spinner.stop("Analysis complete");
          p.log.error(`"${file}" was not found in the indexed repository.`);
          p.log.message("Check the path is relative to the repository root and was actually indexed (has a registered parser for its extension).");
          process.exitCode = 1;
          return;
        }

        const consumers = traceConsumers(repository, file);
        const dependencies = traceDependencies(repository, file);
        const affected = calculateAffectedFiles(repository, file);
        spinner.stop("Analysis complete");

        p.log.info(`Direct consumers (${consumers.direct.length}):`);
        if (consumers.direct.length === 0) {
          p.log.message("  none — nothing imports this file directly");
        } else {
          for (const id of consumers.direct) p.log.message(`  ${id}`);
        }

        p.log.info(`Transitive consumers (${consumers.transitive.length} total, includes direct):`);
        if (consumers.transitive.length > consumers.direct.length) {
          const indirect = consumers.transitive.filter((id) => !consumers.direct.includes(id));
          for (const id of indirect) p.log.message(`  ${id} (indirect)`);
        }

        p.log.info(`This file directly imports (${dependencies.direct.length}):`);
        for (const id of dependencies.direct) p.log.message(`  ${id}`);

        p.log.warn(`Total affected files if "${file}" changes: ${affected.affectedFiles.length}`);
      } catch (err) {
        spinner.stop("Analysis failed");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
