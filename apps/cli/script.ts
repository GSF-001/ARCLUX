// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// `arclux script <file.arclux>` — run a reusable ARCLUX analysis
// pipeline. The language is registry-driven: analyze/doctor/impact/
// graph/search/security are real engine calls, and new parsers or
// detectors appear in the language automatically.

import type { Command } from "commander";
import { runScriptFile } from "../../packages/dsl/script";

export function registerScriptCommand(program: Command): void {
  program
    .command("script")
    .description("Run an .arclux script — a reusable analysis pipeline")
    .argument("<file>", "path to the .arclux script")
    .action(async (filePath: string) => {
      try {
        const { output } = await runScriptFile(filePath);
        for (const line of output) console.log(line);
      } catch (err) {
        console.error(`script failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}