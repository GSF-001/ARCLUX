/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { Kernel } from "../kernel/Kernel";
import type { JobScheduler } from "../scheduler/JobScheduler";
import type { PermissionManager } from "../security/PermissionManager";
import type { WorkspaceManager } from "../workspace/WorkspaceManager";
import type { ConfigurationStore } from "./ConfigurationStore";
import { HealthMonitor, type HealthCheck } from "./HealthMonitor";
import type { SystemState } from "./SystemState";

// The central aggregator (issue #350): composes the already-existing
// pieces — Kernel (processes/services), WorkspaceManager (sessions),
// JobScheduler (jobs), PermissionManager (capabilities), ConfigurationStore
// (settings) — into one immutable SystemState snapshot plus a HealthMonitor
// that reports component health. Does NOT reimplement any of those pieces;
// it only reads them, mirroring how PlatformOrchestrator wires events
// without reimplementing analysis.

export interface SystemManagerOptions {
  kernel: Kernel;
  workspaces?: WorkspaceManager;
  jobs?: JobScheduler;
  permissions?: PermissionManager;
  configuration?: ConfigurationStore;
}

export class SystemManager {
  readonly health = new HealthMonitor();

  constructor(private readonly options: SystemManagerOptions) {
    // Default health checks wired from whatever is available.
    this.health.register("kernel", () => ({
      ok: true,
      detail: `${options.kernel.processTable.list().length} processes, ${options.kernel.serviceRegistry.list().length} services`,
    }));

    if (options.workspaces) {
      this.health.register("workspaces", () => {
        const active = options.workspaces!.list().filter((s) => s.status === "active").length;
        return { ok: true, detail: `${active} active workspace(s)` };
      });
    }

    if (options.jobs) {
      this.health.register("jobs", () => {
        const jobs = options.jobs!.list();
        const failed = jobs.filter((j) => j.status === "failed").length;
        return failed === 0
          ? { ok: true, detail: `${jobs.length} job(s), 0 failed` }
          : { ok: false, detail: `${failed}/${jobs.length} job(s) failed` };
      });
    }
  }

  registerHealthCheck(name: string, check: HealthCheck): void {
    this.health.register(name, check);
  }

  /** Immutable point-in-time snapshot of the whole system. */
  snapshot(): SystemState {
    const { kernel, workspaces, jobs, permissions, configuration } = this.options;
    return {
      takenAt: Date.now(),
      workspaces: workspaces?.snapshots() ?? [],
      processes: kernel.processTable.list(),
      services: kernel.serviceRegistry.list(),
      jobs: jobs?.list() ?? [],
      capabilities: (permissions?.list() ?? []).map(({ processId, set }) => ({
        processId,
        permitted: [...set.permitted],
        effective: [...set.effective],
      })),
      configuration: Object.fromEntries(configuration?.entries() ?? []),
      health: this.health.check(),
    };
  }
}
