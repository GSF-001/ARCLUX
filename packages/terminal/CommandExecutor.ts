/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { spawn } from "node:child_process";
import type { Sandbox } from "../security/Sandbox";
import type { ProcessSpec } from "../runtime/ProcessSpec";
import type { CommandSession } from "./CommandSession";
import { buildShellEnvironment } from "./ShellEnvironment";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

export interface CommandExecutorOptions {
  /** Kill the child after this many ms and resolve with whatever was captured. */
  timeoutMs?: number;
}

/**
 * Executes a single command through the Sandbox's capability checks instead
 * of calling child_process directly (issue #351). The sandbox is enforced
 * BEFORE spawn: a command whose capabilities are not granted never starts.
 * The request is a ProcessSpec because Sandbox's checkSpec/enforce are
 * typed against it — a session is one executed ProcessSpec.
 */
export class CommandExecutor {
  constructor(private readonly sandbox: Sandbox) {}

  async execute(spec: ProcessSpec, options: CommandExecutorOptions = {}): Promise<CommandResult> {
    // Enforce BEFORE spawn — a denied command never starts.
    this.sandbox.enforce(spec);

    const startedAt = Date.now();
    const child = spawn(spec.command, spec.args ?? [], {
      cwd: spec.cwd ?? process.cwd(),
      env: buildShellEnvironment(spec.env),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | null = null;

    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
      }, options.timeoutMs);
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    return new Promise((resolve, reject) => {
      let settled = false;

      const finish = (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve({ stdout, stderr, exitCode, durationMs: Date.now() - startedAt });
      };

      // Spawn failure (ENOENT, permission denied, ...): reject so the caller
      // can mark the session "error" — not a clean exit with null code.
      child.once("error", (err) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        reject(err);
      });

      child.once("close", (code) => {
        finish(code);
      });
    });
  }
}

export type { CommandSession } from "./CommandSession";
