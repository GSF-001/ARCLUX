// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// `arclux workspace open [path]` — drives packages/workspace/ (issue #349):
// ties project + environment + services + processes into one session
// concept. Opens a session (detecting the repo root), then prints an
// immutable snapshot of the session's state — processes/services are
// captured via WorkspaceSnapshot, never read live.
//
// Note: sessions live in-process only (no cross-process persistence yet,
// unlike `ps` which reads records off disk). `open` therefore prints the
// snapshot in the same invocation.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { resolve } from "node:path";
import { WorkspaceManager } from "../../packages/workspace/WorkspaceManager";

export function registerWorkspaceCommand(program: Command): void {
  program
    .command("workspace")
    .description("Open a workspace session for a repository and print its snapshot")
    .argument("[path]", "path to open — auto-detected from cwd if omitted", ".")
    .option("--json", "output raw snapshot JSON instead of the formatted summary")
    .action((pathArg: string, options: { json?: boolean }) => {
      const path = resolve(pathArg);
      const manager = new WorkspaceManager();
      const session = manager.open(path);
      const snapshot = session.snapshot();

      if (options.json) {
        console.log(JSON.stringify(snapshot, null, 2));
        return;
      }

      const state = snapshot.state;
      p.log.success(
        `Workspace open: ${state.repositoryRoot}${state.wasStartPath ? "" : " (walked up from " + path + ")"}`
      );
      p.log.message(`Status: ${state.status}`);
      p.log.message(`Processes: ${snapshot.processes.length}`);
      p.log.message(`Services: ${snapshot.services.length}`);
    });
}
