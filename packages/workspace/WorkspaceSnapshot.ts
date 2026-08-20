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

export interface WorkspaceEnvironment {
  platform: NodeJS.Platform;
  arch: string;
  node: string;
  cwd: string;
  pid: number;
  shell: string | null;
  home: string | null;
  pathAvailable: boolean;
}

export interface WorkspaceSnapshot {
  takenAt: number;
  state: WorkspaceState;
  environment: WorkspaceEnvironment;
  processes: ProcessEntry[];
  services: ServiceHandle[];
}

export function snapshotFromParts(
  state: WorkspaceState,
  processes: ProcessEntry[],
  services: ServiceHandle[],
  environment: WorkspaceEnvironment
): WorkspaceSnapshot {
  return {
    takenAt: Date.now(),
    state: { ...state },
    environment: { ...environment },
    processes: processes.map((entry) => ({ ...entry })),
    services: services.map((handle) => ({ ...handle })),
  };
}
