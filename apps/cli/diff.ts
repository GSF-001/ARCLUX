// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// LAB 1 MVP — see packages/diff/architecturalDiff.ts for the honest
// scope note. This command is a thin CLI wrapper around
// computeArchitecturalDiff: it does NOT diff two separate dependency
// graphs, it traces impact against the CURRENT working tree for files
// that changed between refA and refB.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeLocalDirectory } from "./analyzeLocal";
import { computeArchitecturalDiff } from "../../packages/diff/architecturalDiff";
import type { ChangeStatus } from "../../packages/diff/types";

const STATUS_LABEL: Record<ChangeStatus, string> = {
  added: "added",
  modified: "modified",
  deleted: "deleted",
};

export function registerDiffCommand(program: Command): void {
  program
    .command("diff")
    .description("Show architectural impact of changes between two git refs")
    .argument("<refA>", "base ref (e.g. HEAD~1, main, a commit sha)")
    .argument("<refB>", "target ref (e.g. HEAD, a branch name)")
    .argument("[repoPath]", "path to the repository root", ".")
    .action(async (refA: string, refB: string, repoPath: string) => {
      const spinner = p.spinner();
      spinner.start(`Analyzing diff between ${refA} and ${refB}`);
      try {
        const { repository } = await analyzeLocalDirectory(repoPath);

        const result = computeArchitecturalDiff(repository, repoPath, refA, refB);

        spinner.stop("Analysis complete");

        p.log.info(`Changed files (${result.changedFiles.length}):`);
        if (result.changedFiles.length === 0) {
          p.log.message("  none — no differences between these refs");
        } else {
          for (const file of result.changedFiles) {
            p.log.message(`  [${STATUS_LABEL[file.status]}] ${file.path}`);
          }
        }

        p.log.warn(`Affected files (${result.affectedFiles.length}):`);
        if (result.affectedFiles.length === 0) {
          p.log.message("  none — changed files have no traced consumers");
        } else {
          for (const id of result.affectedFiles) {
            p.log.message(`  ${id}`);
          }
        }
      } catch (err) {
        spinner.stop("Analysis failed");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
