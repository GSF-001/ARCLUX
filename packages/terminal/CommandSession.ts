/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// The shape of one managed command run, as recorded by TerminalManager.
// A session starts as "running", ends as "exited" (clean exit, exitCode
// set) or "error" (spawn failure / sandbox denial / explicit stop). The
// accumulated stdout/stderr are captured so callers (e.g. a future
// `arclux run`) can render them without re-deriving from child_process
// events.

export type CommandStatus = "running" | "exited" | "error";

export interface CommandSession {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  /** The full environment the child was launched with (process.env + overrides). */
  env: Record<string, string>;
  status: CommandStatus;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  stdout: string;
  stderr: string;
}
