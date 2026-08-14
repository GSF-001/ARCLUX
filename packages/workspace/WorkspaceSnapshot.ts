/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { ProcessEntry } from "../shared/types";
import type { ServiceHandle } from "../kernel/ServiceRegistry";
import type { WorkspaceState } from "./WorkspaceState";

// An immutable point-in-time snapshot of a workspace (issue #349). Mirrors
// the ProcSnapshot philosophy (packages/kernel/introspection/ProcSnapshot.ts):
// consumers (CLI, dashboard, restore) read this instead of live mutable
// state, so a restore can rebuild a session from a known-good capture.

export interface WorkspaceSnapshot {
  takenAt: number;
  state: WorkspaceState;
  /** Shallow copies of every process registered in the session's kernel. */
  processes: ProcessEntry[];
  /** Shallow copies of every service registered in the session's kernel. */
  services: ServiceHandle[];
}

export function snapshotFromParts(
  state: WorkspaceState,
  processes: ProcessEntry[],
  services: ServiceHandle[]
): WorkspaceSnapshot {
  return {
    takenAt: Date.now(),
    state: { ...state },
    processes: processes.map((entry) => ({ ...entry })),
    services: services.map((handle) => ({ ...handle })),
  };
}
