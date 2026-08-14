// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Entry point for "arclux daemon": starts ArcluxDaemon and keeps the
// process alive, logging signal bus events to the terminal. This is the
// minimal foreground version -- background/detached process management
// is a follow-up, not built here (see progres/decisions.md entry logged
// alongside this command for why foreground-first was chosen).

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { ArcluxDaemon } from "../../packages/daemon/ArcluxDaemon";

export function registerDaemonCommand(program: Command): void {
  program
    .command("daemon")
    .description("Start ARCLUX as a long-running process: watches the repo and re-analyzes on every change")
    .argument("[path]", "path to the repository root", ".")
    .action(async (targetPath: string) => {
      const daemon = new ArcluxDaemon({ rootPath: targetPath });

      daemon.kernel.signalBus.on("daemon:started", () => {
        p.log.success(`ARCLUX daemon watching ${targetPath}`);
      });

      daemon.kernel.signalBus.on("daemon:bridge:listening", (data: any) => {
        p.log.info(`Local bridge listening at ${data.baseUrl} (GET /analysis, GET /events)`);
      });

      daemon.kernel.signalBus.on("daemon:bridge:error", (data: any) => {
        p.log.error(`Bridge server failed to start: ${data.message}`);
      });

      daemon.kernel.signalBus.on("daemon:analysis:updated", (data: any) => {
        p.log.info(`Re-analyzed: ${data.moduleCount} modules`);
      });

      daemon.kernel.signalBus.on("daemon:diagnostics:updated", (data: any) => {
        if (data.findings.length > 0) {
          p.log.warn(`${data.findings.length} diagnostic finding(s)`);
        }
      });

      daemon.kernel.signalBus.on("daemon:analysis:error", (data: any) => {
        p.log.error(`Analysis error: ${data.message}`);
      });

      daemon.start();

      const shutdown = async () => {
        p.log.info("Stopping daemon...");
        await daemon.stop();
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
}
