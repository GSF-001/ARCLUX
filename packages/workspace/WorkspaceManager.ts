/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { detectRepositoryRoot } from "../environment/EnvironmentDetector";
import { WorkspaceSession } from "./WorkspaceSession";
import type { WorkspaceSnapshot } from "./WorkspaceSnapshot";

// The entry point for workspace sessions (issue #349): ties project +
// environment + services + processes into one session concept. open() walks
// up from the given path to find the repository root (EnvironmentDetector),
// then creates a WorkspaceSession owning a Kernel scoped to that root.
// The manager keeps a registry of open sessions so callers can list/close
// them without touching Kernel pieces ad hoc.

export interface OpenWorkspaceOptions {
  /** Optional kernel override for tests. */
  kernel?: WorkspaceSession["kernel"];
}

export class WorkspaceManager {
  private sessions = new Map<string, WorkspaceSession>();

  /** Opens (or returns the existing) session for a repository root. */
  open(startPath: string, options: OpenWorkspaceOptions = {}): WorkspaceSession {
    const detected = detectRepositoryRoot(startPath);
    const repositoryRoot = detected?.repositoryRoot ?? startPath;

    const existing = this.sessions.get(repositoryRoot);
    if (existing && existing.status === "active") return existing;

    const session = new WorkspaceSession({
      rootPath: startPath,
      repositoryRoot,
      // When no .git is found anywhere above startPath, the fallback IS
      // startPath itself — so wasStartPath is true in that case too.
      wasStartPath: detected ? detected.wasStartPath : true,
      kernel: options.kernel,
    });
    this.sessions.set(repositoryRoot, session);
    return session;
  }

  get(repositoryRoot: string): WorkspaceSession | undefined {
    return this.sessions.get(repositoryRoot);
  }

  list(): WorkspaceSession[] {
    return [...this.sessions.values()];
  }

  snapshots(): WorkspaceSnapshot[] {
    return this.list().map((session) => session.snapshot());
  }

  close(repositoryRoot: string): boolean {
    const session = this.sessions.get(repositoryRoot);
    if (!session) return false;
    session.close();
    this.sessions.delete(repositoryRoot);
    return true;
  }

  closeAll(): void {
    for (const session of this.sessions.values()) session.close();
    this.sessions.clear();
  }
}
