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
 * The shell's session context — the "mini-OS" state the user sketched:
 * workspace (state), environment (platform/arch/node/cwd/pid/shell/home),
 * processes, services. Everything here is REAL — WorkspaceManager opens a
 * WorkspaceSession owning a Kernel (process table + service registry +
 * signal bus) scoped to the analyzed repository root, and environment
 * values come from process/os, not from fake constants.
 *
 * Plugins receive this context, so a plugin can start a process, register
 * a service, or read the environment without ARCLUX having a built-in
 * feature for whatever the plugin is trying to do — that's the
 * "build anything" surface.
 */

import { arch, homedir, platform } from "node:os";
import type { ProcessEntry } from "../kernel/ProcessTable";
import type { ServiceHandle } from "../kernel/ServiceRegistry";
import { WorkspaceManager, type OpenWorkspaceOptions } from "../workspace/WorkspaceManager";
import type { WorkspaceSession } from "../workspace/WorkspaceSession";
import type { WorkspaceSnapshot } from "../workspace/WorkspaceSnapshot";
import { ProcessManager } from "../runtime/ProcessManager";
import type { ProcessSpec } from "../runtime/ProcessSpec";

export interface SessionEnvironment {
  platform: string;
  arch: string;
  node: string;
  cwd: string;
  pid: number;
  shell: string;
  home: string;
}

export function detectEnvironment(): SessionEnvironment {
  return {
    platform: platform(),
    arch: arch(),
    node: process.version,
    cwd: process.cwd(),
    pid: process.pid,
    shell: process.env.SHELL ?? "",
    home: homedir(),
  };
}

/** Point-in-time snapshot of the whole session — the shell's `system` output. */
export interface SessionSnapshot {
  takenAt: number;
  environment: SessionEnvironment;
  workspace: WorkspaceSnapshot | null;
}

export class ShellSession {
  private readonly workspaceManager = new WorkspaceManager();
  private workspace: WorkspaceSession | null = null;
  private readonly processManagers = new Map<string, ProcessManager>();

  constructor(private readonly openOptions: OpenWorkspaceOptions = {}) {}

  /** Opens (or reuses) the workspace session for rootPath's repo root. */
  openWorkspace(rootPath: string): WorkspaceSession {
    const session = this.workspaceManager.open(rootPath, this.openOptions);
    this.workspace = session;
    return session;
  }

  get activeWorkspace(): WorkspaceSession | null {
    return this.workspace;
  }

  get kernel() {
    return this.workspace?.kernel ?? null;
  }

  /** The session's ProcessManager, created lazily for the active workspace. */
  processManager(): ProcessManager | null {
    if (!this.workspace) return null;
    const repositoryRoot = this.workspace.getState().repositoryRoot;
    const existing = this.processManagers.get(repositoryRoot);
    if (existing) return existing;
    const manager = new ProcessManager(this.workspace.kernel);
    this.processManagers.set(repositoryRoot, manager);
    return manager;
  }

  /** Starts a process inside the session's kernel (real spawn + capability checks). */
  startProcess(spec: ProcessSpec): boolean {
    const manager = this.processManager();
    if (!manager) return false;
    manager.start(spec);
    return true;
  }

  stopProcess(id: string): boolean {
    const manager = this.processManager();
    if (!manager) return false;
    manager.stop(id);
    return true;
  }

  registerService(name: string, processId: string): boolean {
    if (!this.workspace) return false;
    this.workspace.registerService({ name, processId, registeredAt: Date.now() });
    return true;
  }

  snapshot(): SessionSnapshot {
    return {
      takenAt: Date.now(),
      environment: detectEnvironment(),
      workspace: this.workspace?.snapshot() ?? null,
    };
  }

  /** Convenience for output: flattened process list of the active workspace. */
  processes(): ProcessEntry[] {
    return this.workspace?.snapshot().processes ?? [];
  }

  services(): ServiceHandle[] {
    return this.workspace?.snapshot().services ?? [];
  }

  close(): void {
    this.workspaceManager.closeAll();
    this.workspace = null;
    this.processManagers.clear();
  }
}
