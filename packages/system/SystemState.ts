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
import type { JobStateEntry } from "../scheduler/JobState";
import type { WorkspaceSnapshot } from "../workspace/WorkspaceSnapshot";
import type { SystemHealth } from "./HealthMonitor";

// The central system state shape (issue #350): one immutable snapshot
// aggregating everything the platform knows — workspaces, processes,
// services, jobs, permissions, configuration and health. Consumers (CLI
// `system status`, future web dashboard) read this instead of reaching
// into Kernel/JobScheduler/PermissionManager pieces ad hoc. All fields
// are shallow copies of the underlying live objects, same philosophy as
// ProcSnapshot/WorkspaceSnapshot.

export interface SystemState {
  /** epoch ms when this snapshot was taken */
  takenAt: number;
  workspaces: WorkspaceSnapshot[];
  processes: ProcessEntry[];
  services: ServiceHandle[];
  jobs: JobStateEntry[];
  /** processId → granted capability set (see packages/security/Capability.ts) */
  capabilities: { processId: string; permitted: string[]; effective: string[] }[];
  configuration: Record<string, unknown>;
  health: SystemHealth;
}
