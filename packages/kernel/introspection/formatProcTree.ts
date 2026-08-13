/**
 * Copyright 2026 Mikatoshi
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { ProcessStatus, type ProcessEntry, type ProcessStatusValue } from "../ProcessTable";
import type { ProcSnapshot } from "./ProcSnapshot";

// Display order: most-actionable states first (errored needs attention,
// launching/stopping are transient, stopped/online are steady states).
const STATUS_ORDER: ProcessStatusValue[] = [
  ProcessStatus.ERRORED,
  ProcessStatus.LAUNCHING,
  ProcessStatus.STOPPING,
  ProcessStatus.ONLINE,
  ProcessStatus.STOPPED,
];

function formatEntryLine(entry: ProcessEntry, isLast: boolean): string {
  const branch = isLast ? "└─" : "├─";
  const pid = entry.pid !== null ? `pid ${entry.pid}` : "no pid";

  const detail =
    entry.status === ProcessStatus.ERRORED || entry.status === ProcessStatus.STOPPED
      ? `exit code ${entry.lastExitCode ?? "unknown"}`
      : entry.startedAt !== null
        ? `started ${new Date(entry.startedAt).toLocaleTimeString()}`
        : "not started";

  const restarts = entry.restarts > 0 ? `, ${entry.restarts} restart${entry.restarts === 1 ? "" : "s"}` : "";

  return `${branch} ${entry.name} (${pid}, ${detail}${restarts})`;
}

/**
 * Render a ProcSnapshot as a human-readable tree, grouped by status.
 *
 * This is a display concern only — it does not mutate or re-derive
 * anything from the live ProcessTable, it only formats what's already
 * in the snapshot. Intended for CLI `ps`/`proc` output and the web
 * dashboard's process panel.
 */
export function formatProcTree(snapshot: ProcSnapshot): string {
  if (snapshot.processes.length === 0) {
    return "No processes registered.";
  }

  const grouped = new Map<ProcessStatusValue, ProcessEntry[]>();
  for (const entry of snapshot.processes) {
    const bucket = grouped.get(entry.status) ?? [];
    bucket.push(entry);
    grouped.set(entry.status, bucket);
  }

  const lines: string[] = [`Process snapshot @ ${new Date(snapshot.takenAt).toLocaleTimeString()}`];

  for (const status of STATUS_ORDER) {
    const entries = grouped.get(status);
    if (!entries || entries.length === 0) continue;

    lines.push(`${status.toUpperCase()} (${entries.length})`);
    entries.forEach((entry, i) => {
      lines.push(formatEntryLine(entry, i === entries.length - 1));
    });
  }

  return lines.join("\n");
}
