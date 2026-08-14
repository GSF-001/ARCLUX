/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// The overall state of one workspace (issue #349): the repository root the
// session was opened on, the detected environment (was the start path the
// root or a subfolder walked up), and lifecycle metadata. Process/service
// listings are NOT part of this object — they live in the session's Kernel
// (ProcessTable/ServiceRegistry) and are captured immutably by
// WorkspaceSnapshot when a consumer needs a point-in-time read.

export type WorkspaceStatus = "active" | "closed" | "error";

export interface WorkspaceState {
  rootPath: string;
  /** Absolute path to the repository root (the directory containing .git). */
  repositoryRoot: string;
  /** True if the open() path itself was the repository root. */
  wasStartPath: boolean;
  status: WorkspaceStatus;
  startedAt: number;
  /** Set when the session failed to start or was stopped by an error. */
  closedAt: number | null;
  error?: string;
}
