/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { Kernel } from "../kernel/Kernel";
import { ProcessManager } from "./ProcessManager";
import type { ProcessSpec } from "./ProcessSpec";

export class RuntimeManager {
  readonly kernel = new Kernel();
  readonly processManager: ProcessManager;

  constructor() {
    this.processManager = new ProcessManager(this.kernel);
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
