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
 * `arclux shell [path]` — start the interactive ARCLUX session. The
 * Repository stays in memory between commands, so queries are instant.
 * The REPL itself uses node:repl (history, tab-completion, .exit) with
 * ArcluxShell as the command engine.
 */

import type { Command } from "commander";
import repl from "node:repl";
import { resolve } from "node:path";
import { ArcluxShell } from "../../packages/shell/ArcluxShell";

export function registerShellCommand(program: Command): void {
  program
    .command("shell [path]")
    .description("Start an interactive ARCLUX session (repo stays in memory between commands)")
    .action(async (pathArg?: string) => {
      const shell = new ArcluxShell();

      if (pathArg) {
        try {
          const result = await shell.analyze(resolve(pathArg));
          for (const line of result.output) console.log(`  ${line}`);
        } catch (err) {
          console.error(`analyze failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // With piped stdin (scripts/tests), node:repl fires eval for every
      // buffered line without waiting for the previous callback, which
      // would run queries before `analyze` finishes. Serialize commands
      // explicitly through a promise chain.
      let queue: Promise<void> = Promise.resolve();

      const prompt = (): string => `${shell.promptLabel}${shell.watchActive ? "*" : ""}> `;

      const rl = repl.start({
        prompt: prompt(),
        useGlobal: false,
        ignoreUndefined: true,
        // Custom eval: every line goes to ArcluxShell.handleCommand as a
        // command, never parsed as JavaScript. Without this, node:repl's
        // default eval tries to evaluate "~/flask" / "impact file.ts" as
        // JS and spams the session with SyntaxErrors.
        eval: async (
          cmd: string,
          _ctx: unknown,
          _file: string,
          cb: (err: Error | null, result?: unknown) => void
        ) => {
          queue = queue.then(async () => {
            try {
              const result = await shell.handleCommand(cmd);
              for (const out of result.output) rl.outputStream.write(`  ${out}\n`);
              if (result.exit) rl.close();
            } catch (err) {
              rl.outputStream.write(`  [error] ${err instanceof Error ? err.message : String(err)}\n`);
            }
          });
          try {
            await queue;
            cb(null, undefined);
          } catch (err) {
            cb(err instanceof Error ? err : new Error(String(err)));
          }
          rl.setPrompt(prompt());
          rl.prompt();
        },
      });

      // Keep the prompt label fresh after switching repos inside the session.
      rl.prompt();
    });
}