/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// `arclux work <file> <newContentFile>` -- proves the Change Pipeline works
// end to end (PatchSet -> ChangePlan -> ChangeExecutor -> RecoveryManager)
// without intent parsing, which doesn't exist yet. Reads current content
// from <file> and replacement content from <newContentFile>, applies it as
// a transactional write.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { readFileSync } from "node:fs";
import { createPatchSet } from "../../../packages/change/PatchSet";
import { createChangePlan } from "../../../packages/change/ChangePlan";
import { executeChangePlan } from "../../../packages/change/ChangeExecutor";

export function registerWorkCommand(program: Command): void {
  program
    .command("work")
    .description("Apply a file's content from a source file via the Change Pipeline (ChangePlan -> PatchSet -> ChangeExecutor)")
    .argument("<file>", "target file to modify")
    .argument("<newContentFile>", "file containing the replacement content")
    .action(async (file: string, newContentFile: string) => {
      const spinner = p.spinner();
      spinner.start(`Applying change to ${file}`);

      try {
        const originalContent = readFileSync(file, "utf-8");
        const newContent = readFileSync(newContentFile, "utf-8");

        const patchSet = createPatchSet([
          { filePath: file, originalContent, newContent },
        ]);
        const plan = createChangePlan(`work: apply ${newContentFile} to ${file}`, patchSet, []);
        const result = executeChangePlan(plan);

        spinner.stop("Change applied");

        if (result.filesWritten.length > 0) {
          p.log.success(`Written: ${result.filesWritten.join(", ")}`);
        }
        if (result.failedFiles.length > 0) {
          p.log.error(`Failed:`);
          for (const f of result.failedFiles) {
            p.log.message(`  ${f.filePath} — ${f.error}`);
          }
          process.exitCode = 1;
        }
      } catch (err) {
        spinner.stop("Change failed");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
