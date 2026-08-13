/**
 * Copyright 2026 Mikatoshi
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { Command } from "commander";
import { readLiveProcessRecords } from "../../../packages/storage/SnapshotManager";
import { snapshotFromEntries } from "../../../packages/kernel/introspection/ProcSnapshot";
import { formatProcTree } from "../../../packages/kernel/introspection/formatProcTree";

export function registerPsCommand(program: Command): void {
  program
    .command("ps")
    .description("List processes currently registered with the ARCLUX kernel")
    .option("--json", "output raw snapshot JSON instead of the formatted tree")
    .action((options: { json?: boolean }) => {
      const processes = readLiveProcessRecords();
      const snapshot = snapshotFromEntries(processes);

      if (options.json) {
        console.log(JSON.stringify(snapshot, null, 2));
        return;
      }

      console.log(formatProcTree(snapshot));
    });
}
