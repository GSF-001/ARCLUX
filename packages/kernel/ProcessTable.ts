/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// ProcessStatus/ProcessStatusValue/ProcessEntry moved to packages/shared/types.ts
// (2026-08-14, issue #312) — re-exported here so existing kernel importers stay
// unchanged. Storage imports them directly from shared to break the package cycle.
import {
  ProcessStatus,
  type ProcessStatusValue,
  type ProcessEntry,
} from "../shared/types";

export {
  ProcessStatus,
  type ProcessStatusValue,
  type ProcessEntry,
} from "../shared/types";

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
