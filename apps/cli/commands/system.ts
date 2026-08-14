// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// `arclux system status` — reads packages/system/ (issue #350): aggregates
// kernel processes/services, workspace sessions, jobs, permissions and
// health into one snapshot. Follows the ps.ts pattern of reading through
// an immutable snapshot (SystemManager.snapshot()) instead of live pieces.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { Kernel } from "../../../packages/kernel/Kernel";
import { SystemManager } from "../../../packages/system/SystemManager";

export function registerSystemCommand(program: Command): void {
  const system = program
    .command("system")
    .description("System state and component health (workspaces + processes + services + jobs)");

  system
    .command("status")
    .description("Print the aggregated system state snapshot")
    .option("--json", "output raw JSON instead of the formatted summary")
    .action((options: { json?: boolean }) => {
      // No workspaces/jobs wired in a one-shot CLI process (they're
      // in-process state) — this command aggregates what a fresh Kernel has:
      // processes/services tables + health. See packages/system/SystemManager.
      const manager = new SystemManager({ kernel: new Kernel() });
      const state = manager.snapshot();

      if (options.json) {
        console.log(JSON.stringify(state, null, 2));
        return;
      }

      p.log.message(`System status: ${state.health.overall} (at ${new Date(state.takenAt).toISOString()})`);
      for (const component of state.health.components) {
        const marker = component.status === "ok" ? "✓" : component.status === "degraded" ? "⚠" : "✗";
        p.log.message(`  ${marker} ${component.name}: ${component.detail ?? component.status}`);
      }
    });
}
