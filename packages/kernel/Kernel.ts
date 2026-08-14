/**
 * Copyright 2026 Mikatoshi
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
import { takeProcSnapshot, type ProcSnapshot } from "./introspection/ProcSnapshot";
import { formatProcTree } from "./introspection/formatProcTree";
import { writeProcessRecord, removeProcessRecord } from "../storage/SnapshotManager";

export class Kernel {
  readonly processTable = new ProcessTable();
  readonly signalBus = new SignalBus();
  readonly serviceRegistry = new ServiceRegistry();

  registerProcess(entry: Omit<ProcessEntry, "restarts" | "lastExitCode">): ProcessEntry {
    const registered = this.processTable.register(entry);
    writeProcessRecord(registered);
    this.signalBus.emit("process:registered", registered);
    return registered;
  }

  updateProcessStatus(id: string, status: ProcessStatusValue, exitCode?: number): void {
    this.processTable.updateStatus(id, status, exitCode);
    const entry = this.processTable.get(id);
    if (entry) writeProcessRecord(entry);
    this.signalBus.emit(`process:${status}`, entry);
  }

  /** Remove a process from the table and delete its persisted record. */
  removeProcess(id: string): boolean {
    const removed = this.processTable.remove(id);
    removeProcessRecord(id);
    if (removed) this.signalBus.emit("process:removed", { id });
    return removed;
  }

  registerService(handle: ServiceHandle): void {
    this.serviceRegistry.register(handle);
    this.signalBus.emit("service:registered", handle);
  }

  /** Update runtime info (pid, startedAt) discovered after spawn, persisting the change. */
  setProcessRuntimeInfo(id: string, info: { pid: number | null; startedAt: number | null }): void {
    const entry = this.processTable.get(id);
    if (!entry) return;
    entry.pid = info.pid;
    entry.startedAt = info.startedAt;
    writeProcessRecord(entry);
    this.signalBus.emit("process:updated", entry);
  }

  snapshotProcesses(): ProcSnapshot {
    return takeProcSnapshot(this.processTable);
  }

  printProcessTree(): string {
    return formatProcTree(this.snapshotProcesses());
  }

  shutdown(): void {
    // Clean up this kernel's own persisted process records so `ps` run
    // from another process doesn't keep reporting entries that only
    // existed in this now-dead kernel's memory.
    for (const entry of this.processTable.list()) {
      removeProcessRecord(entry.id);
    }
    this.signalBus.emit("kernel:shutdown", { at: Date.now() });
    this.signalBus.clear();
  }
}
