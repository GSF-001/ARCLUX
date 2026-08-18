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
 * `arclux exec <command> [args...]` — run an arbitrary command through
 * TerminalManager (packages/terminal), which routes it through the
 * Sandbox's capability checks instead of calling child_process directly.
 * Every run is recorded as a session; the session id is printed so later
 * `arclux work`/diagnostics surfaces can reference it. This is the first
 * production consumer of packages/terminal (TerminalManager was built +
 * tested but orphaned until now).
 */

import type { Command } from "commander";
import { TerminalManager } from "../../../packages/terminal/TerminalManager";

export function registerExecCommand(program: Command): void {
  program
    .command("exec <command> [args...]")
    .description("Run a command through the sandboxed terminal layer (records a session)")
    .option("-d, --cwd <dir>", "working directory for the command", process.cwd())
    .action(async (command: string, args: string[], options: { cwd?: string }) => {
      const terminal = new TerminalManager();
      const sessionId = `exec-${Date.now()}`;

      try {
        const session = await terminal.run({
          id: sessionId,
          name: command,
          command,
          args: args,
          cwd: options.cwd,
        });

        if (session.stdout) process.stdout.write(session.stdout);
        if (session.stderr) process.stderr.write(session.stderr);

        if (session.exitCode === 0) {
          console.log(`[ok] session ${session.id} exited 0`);
        } else {
          console.error(`[fail] session ${session.id} exited ${session.exitCode ?? "?"}`);
          process.exitCode = session.exitCode ?? 1;
        }
      } catch (err) {
        console.error(`[error] ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}