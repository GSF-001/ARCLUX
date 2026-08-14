/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// The unit of fan-out produced by NotificationManager: a diagnostic
// finding normalized into a channel-neutral shape. Channels (console,
// desktop notification, editor popup) render this — they don't re-derive
// it from DiagnosticFinding themselves, and they don't need to know which
// signal bus event produced it.

export type NotificationSeverity = "error" | "warning" | "info";

export interface Notification {
  /** Stable id, unique per finding+location: `${source}:${filePath}:${line}`. */
  id: string;
  severity: NotificationSeverity;
  message: string;
  /** Milliseconds since epoch — when the underlying event was produced. */
  at: number;
  /** The check/event that produced this (e.g. a diagnostic checkId). */
  source: string;
  /** First location's file, for jump-to-file affordances. Null when the finding has no location. */
  filePath: string | null;
  /** First location's line (1-based). Null when the finding is file-level only. */
  line: number | null;
}
