//**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Kernel — orchestrates ProcessTable, SignalBus, ServiceRegistry. ARCLUX's
 * equivalent of PM2's God object, scoped to ARCLUX's own internal services.
 */

import { ProcessTable, type ProcessEntry, type ProcessStatusValue } from "./ProcessTable";
import { SignalBus } from "./SignalBus";
import { ServiceRegistry, type ServiceHandle } from "./ServiceRegistry";

export class Kernel {
  readonly processTable = new ProcessTable();
  readonly signalBus = new SignalBus();
  readonly serviceRegistry = new ServiceRegistry();

  registerProcess(entry: Omit<ProcessEntry, "restarts" | "lastExitCode">): ProcessEntry {
    const registered = this.processTable.register(entry);
    this.signalBus.emit("process:registered", registered);
    return registered;
  }

  updateProcessStatus(id: string, status: ProcessStatusValue, exitCode?: number): void {
    this.processTable.updateStatus(id, status, exitCode);
    const entry = this.processTable.get(id);
    this.signalBus.emit(`process:${status}`, entry);
  }

  registerService(handle: ServiceHandle): void {
    this.serviceRegistry.register(handle);
    this.signalBus.emit("service:registered", handle);
  }

  shutdown(): void {
    this.signalBus.emit("kernel:shutdown", { at: Date.now() });
    this.signalBus.clear();
  }
}
