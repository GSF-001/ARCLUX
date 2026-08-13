/**
 * Copyright 2026 Mikatoshi
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { ProcessEntry, ProcessTable } from "../ProcessTable";

/**
 * An immutable snapshot of process state at one point in time.
 *
 * Snapshots exist so introspection (CLI `ps`, web dashboard, diagnostics)
 * never reads live, mutable state directly — whether that's an in-memory
 * ProcessTable in the same process, or records read off disk from a
 * different process entirely.
 */
export interface ProcSnapshot {
  /** epoch ms when this snapshot was taken */
  takenAt: number;
  /** shallow copies of every process entry at snapshot time */
  processes: ProcessEntry[];
}

/** Build a ProcSnapshot from any list of process entries. */
export function snapshotFromEntries(processes: ProcessEntry[]): ProcSnapshot {
  return {
    takenAt: Date.now(),
    processes: processes.map((entry) => ({ ...entry })),
  };
}

/**
 * Capture the current state of an in-memory ProcessTable as a
 * ProcSnapshot. Only meaningful within the same Node process that
 * owns the table — for cross-process use (e.g. the CLI), read
 * persisted records instead (see packages/storage/SnapshotManager).
 */
export function takeProcSnapshot(table: ProcessTable): ProcSnapshot {
  return snapshotFromEntries(table.list());
}
