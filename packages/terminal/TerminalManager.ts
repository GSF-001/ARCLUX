/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { ProcessSpec } from "../runtime/ProcessSpec";
import { Sandbox } from "../security/Sandbox";
import { PermissionManager } from "../security/PermissionManager";
import { Capability, type CapabilityValue } from "../security/Capability";
import { CommandExecutor, type CommandExecutorOptions } from "./CommandExecutor";
import type { CommandSession } from "./CommandSession";
import { buildShellEnvironment } from "./ShellEnvironment";

// Managed shell execution layer (issue #351): runs ProcessSpecs through
// the Sandbox's capability checks instead of calling child_process directly.
// TerminalManager owns the PermissionManager + Sandbox pair (same wiring as
// ProcessManager in packages/runtime) and tracks every run as a session.

export interface TerminalManagerOptions {
  /**
   * Capabilities granted to a session id on first run. Defaults to the
   * same baseline ProcessManager grants: EXEC always, ENV_WRITE when the
   * spec carries env overrides. Callers wanting a tighter policy should
   * pre-grant their own set for the session id before run().
   */
  defaultCapabilities?: CapabilityValue[];
}

export class TerminalManager {
  readonly permissions = new PermissionManager();
  private readonly sandbox = new Sandbox(this.permissions);
  private readonly executor = new CommandExecutor(this.sandbox);
  private readonly sessions = new Map<string, CommandSession>();
  private readonly defaultCapabilities: CapabilityValue[];

  constructor(options: TerminalManagerOptions = {}) {
    this.defaultCapabilities =
      options.defaultCapabilities ?? [Capability.EXEC, Capability.ENV_WRITE];
  }

  /** Run a command to completion, recording it as a session. */
  async run(spec: ProcessSpec, options: CommandExecutorOptions = {}): Promise<CommandSession> {
    if (this.sessions.has(spec.id)) {
      throw new Error(`Terminal: session "${spec.id}" already exists — pick a unique id`);
    }

    // Grant the baseline on first run (mirrors ProcessManager.start()).
    if (!this.permissions.getCapabilitySet(spec.id)) {
      this.permissions.grant(spec.id, this.defaultCapabilities);
    }

    const session: CommandSession = {
      id: spec.id,
      command: spec.command,
      args: spec.args ?? [],
      cwd: spec.cwd ?? process.cwd(),
      env: buildShellEnvironment(spec.env),
      status: "running",
      exitCode: null,
      startedAt: Date.now(),
      endedAt: null,
      stdout: "",
      stderr: "",
    };
    this.sessions.set(spec.id, session);

    try {
      const result = await this.executor.execute(spec, options);
      session.status = "exited";
      session.exitCode = result.exitCode;
      session.stdout = result.stdout;
      session.stderr = result.stderr;
      session.endedAt = Date.now();
    } catch (err) {
      // Sandbox denial / spawn error: the session is recorded as failed so
      // callers can see WHY, not silently dropped.
      session.status = "error";
      session.endedAt = Date.now();
      session.stderr = err instanceof Error ? err.message : String(err);
      throw err;
    }
    return session;
  }

  get(id: string): CommandSession | undefined {
    return this.sessions.get(id);
  }

  list(): CommandSession[] {
    return [...this.sessions.values()];
  }
}
