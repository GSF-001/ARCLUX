/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

export const ProcessStatus = {
  LAUNCHING: "launching",
  ONLINE: "online",
  STOPPING: "stopping",
  STOPPED: "stopped",
  ERRORED: "errored",
} as const;

export type ProcessStatusValue = (typeof ProcessStatus)[keyof typeof ProcessStatus];

export interface ProcessEntry {
  id: string;
  pid: number | null;
  name: string;
  command: string;
  args: string[];
  cwd: string;
  status: ProcessStatusValue;
  startedAt: number | null;
  restarts: number;
  lastExitCode: number | null;
}

export class ProcessTable {
  private entries = new Map<string, ProcessEntry>();

  register(entry: Omit<ProcessEntry, "restarts" | "lastExitCode">): ProcessEntry {
    const full: ProcessEntry = { ...entry, restarts: 0, lastExitCode: null };
    this.entries.set(entry.id, full);
    return full;
  }

  updateStatus(id: string, status: ProcessStatusValue, exitCode?: number): void {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`ProcessTable: unknown process id "${id}"`);
    entry.status = status;
    if (status === ProcessStatus.ERRORED || status === ProcessStatus.STOPPED) {
      entry.lastExitCode = exitCode ?? null;
    }
  }

  incrementRestarts(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`ProcessTable: unknown process id "${id}"`);
    entry.restarts += 1;
  }

  remove(id: string): boolean {
    return this.entries.delete(id);
  }

  get(id: string): ProcessEntry | undefined {
    return this.entries.get(id);
  }

  list(): ProcessEntry[] {
    return Array.from(this.entries.values());
  }
}
