/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { Kernel } from "../kernel/Kernel";
import { ProcessStatus } from "../shared/types";
import type { ProcessSpec } from "../runtime/ProcessSpec";
import type { ServiceHandle } from "../kernel/ServiceRegistry";
import { snapshotFromParts, type WorkspaceSnapshot } from "./WorkspaceSnapshot";
import type { WorkspaceState, WorkspaceStatus } from "./WorkspaceState";

// One active workspace session (issue #349): owns a Kernel (process table,
// service registry, signal bus) scoped to a detected repository root. The
// session is the tie point that binds project + environment + services +
// processes together — RuntimeManager-style callers (CLI, future API
// routes) drive this instead of touching Kernel pieces ad hoc.

export interface WorkspaceSessionOptions {
  rootPath: string;
  repositoryRoot: string;
  wasStartPath: boolean;
  kernel?: Kernel;
}

export class WorkspaceSession {
  readonly kernel: Kernel;
  private state: WorkspaceState;
  private readonly startedAt: number;

  constructor(options: WorkspaceSessionOptions) {
    this.kernel = options.kernel ?? new Kernel();
    this.startedAt = Date.now();
    this.state = {
      rootPath: options.rootPath,
      repositoryRoot: options.repositoryRoot,
      wasStartPath: options.wasStartPath,
      status: "active",
      startedAt: this.startedAt,
      closedAt: null,
    };
  }

  getState(): WorkspaceState {
    return { ...this.state };
  }

  /** Registers a process with the session's kernel (no spawn — ProcessManager does the actual execution). */
  registerProcess(spec: ProcessSpec): void {
    this.kernel.registerProcess({
      id: spec.id,
      pid: null,
      name: spec.name,
      command: spec.command,
      args: spec.args ?? [],
      cwd: spec.cwd ?? this.state.repositoryRoot,
      status: ProcessStatus.LAUNCHING,
      startedAt: null,
    });
  }

  registerService(handle: ServiceHandle): void {
    this.kernel.registerService(handle);
  }

  /** Immutable point-in-time read of processes + services + state. */
  snapshot(): WorkspaceSnapshot {
    return snapshotFromParts(this.state, this.kernel.processTable.list(), this.kernel.serviceRegistry.list());
  }

  /** Closes the session: marks state closed and shuts down the kernel. */
  close(): void {
    if (this.state.status !== "active") return;
    this.state.status = "closed";
    this.state.closedAt = Date.now();
    this.kernel.shutdown();
  }

  setError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.state.status = "error";
    this.state.error = message;
    this.state.closedAt = Date.now();
  }

  get status(): WorkspaceStatus {
    return this.state.status;
  }
}
