// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// packages/impact/* is still 0% implemented (see PROGRES.md — ARCLUX's
// #1 priority gap). This command is deliberately NOT a fake
// implementation: it reports its own unimplemented status rather than
// silently returning an empty or fabricated result, which would be worse
// than not having the command at all.

import type { Command } from "commander";
import * as p from "@clack/prompts";

export function registerImpactCommand(program: Command): void {
  program
    .command("impact")
    .description("Show what's affected by a file change (not yet implemented)")
    .argument("[path]", "path to the repository root", ".")
    .action(() => {
      p.log.warn("`arclux impact` is not implemented yet.");
      p.log.message("packages/impact/* is still an empty stub \u2014 see PROGRES.md priority #1.");
      process.exitCode = 1;
    });
}
