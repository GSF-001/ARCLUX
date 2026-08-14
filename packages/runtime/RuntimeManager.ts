/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * RuntimeManager — top-level entry point for the platform runtime.
 * Wires Kernel (process table, signal bus, service registry) together
 * with ProcessManager (actual OS process spawning). This is what
 * apps/cli/commands/run.ts and future apps/web/app/api/runtime/route.ts
 * should call into, instead of touching Kernel/ProcessManager directly.
 */

import { Kernel } from "../kernel/Kernel";
import { ProcessManager } from "./ProcessManager";
import type { ProcessSpec } from "./ProcessSpec";
import { recoverFromJournal } from "../storage/RecoveryManager";

export class RuntimeManager {
  readonly kernel = new Kernel();
  readonly processManager: ProcessManager;

  constructor() {
    // Replay any incomplete write-ahead-log transactions from a previous
    // crash before anything else touches storage -- see
    // packages/storage/RecoveryManager.ts. Committed-but-unapplied writes
    // are redone; never-committed writes are discarded, matching jbd2's
    // recovery semantics.
    const recovery = recoverFromJournal();
    if (recovery.redone.length > 0 || recovery.discarded.length > 0) {
      // Emitted after kernel exists, not before -- see emit call below.
    }

    this.processManager = new ProcessManager(this.kernel);

    if (recovery.redone.length > 0 || recovery.discarded.length > 0) {
      this.kernel.signalBus.emit("recovery:replayed", recovery);
    }
  }

  startService(spec: ProcessSpec): void {
    this.processManager.start(spec);
    this.kernel.registerService({
      name: spec.name,
      processId: spec.id,
      registeredAt: Date.now(),
    });
  }

  stopService(id: string): void {
    this.processManager.stop(id);
  }

  listProcesses() {
    return this.kernel.processTable.list();
  }
}
