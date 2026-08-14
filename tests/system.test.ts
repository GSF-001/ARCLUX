// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for issue #350: packages/system/ aggregates kernel processes/
// services, workspace sessions, jobs, permissions and health into one
// immutable SystemState snapshot.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Kernel } from "../packages/kernel/Kernel";
import { JobScheduler } from "../packages/scheduler/JobScheduler";
import { createJob } from "../packages/scheduler/Job";
import { PermissionManager } from "../packages/security/PermissionManager";
import { Capability } from "../packages/security/Capability";
import { ConfigurationStore } from "../packages/system/ConfigurationStore";
import { HealthMonitor } from "../packages/system/HealthMonitor";
import { SystemManager } from "../packages/system/SystemManager";
import { WorkspaceManager } from "../packages/workspace/WorkspaceManager";
import { ProcessStatus } from "../packages/shared/types";

let dirs: string[] = [];

function makeRepoRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "arclux-sys-"));
  mkdirSync(join(dir, ".git"));
  dirs.push(dir);
  return dir;
}

function cleanup(): void {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
}

beforeEach(() => cleanup());
afterEach(() => cleanup());

describe("ConfigurationStore (issue #350)", () => {
  it("falls back to defaults for declared keys", () => {
    const store = new ConfigurationStore({ defaults: { maxWorkers: 4 } });
    expect(store.get("maxWorkers")).toBe(4);
    expect(store.get("unknown")).toBeUndefined();
  });

  it("set overrides the default; delete restores it", () => {
    const store = new ConfigurationStore({ defaults: { maxWorkers: 4 } });
    store.set("maxWorkers", 8);
    expect(store.get("maxWorkers")).toBe(8);
    expect(store.delete("maxWorkers")).toBe(true);
    expect(store.get("maxWorkers")).toBe(4);
  });

  it("lists only explicitly-set entries", () => {
    const store = new ConfigurationStore({ defaults: { a: 1 } });
    store.set("b", 2);
    expect(store.listKeys()).toEqual(["b"]);
    expect(store.entries()).toEqual([["b", 2]]);
  });
});

describe("HealthMonitor (issue #350)", () => {
  it("overall is ok when all checks pass", () => {
    const monitor = new HealthMonitor();
    monitor.register("a", () => ({ ok: true }));
    monitor.register("b", () => ({ ok: true, detail: "fine" }));

    const health = monitor.check();
    expect(health.overall).toBe("ok");
    expect(health.components).toHaveLength(2);
    expect(health.components[0]).toMatchObject({ name: "a", status: "ok" });
  });

  it("a failing check degrades overall", () => {
    const monitor = new HealthMonitor();
    monitor.register("a", () => ({ ok: true }));
    monitor.register("b", () => ({ ok: false, detail: "2/5 failed" }));

    expect(monitor.check().overall).toBe("degraded");
  });

  it("a throwing check marks the component down", () => {
    const monitor = new HealthMonitor();
    monitor.register("a", () => ({ ok: true }));
    monitor.register("b", () => {
      throw new Error("bridge unreachable");
    });

    const health = monitor.check();
    expect(health.overall).toBe("down");
    expect(health.components[1]).toMatchObject({ name: "b", status: "down", detail: "bridge unreachable" });
  });
});

describe("SystemManager (issue #350)", () => {
  it("aggregates processes, services, jobs, capabilities and health", async () => {
    const kernel = new Kernel();
    kernel.registerProcess({
      id: "p1",
      pid: null,
      name: "demo",
      command: process.execPath,
      args: [],
      cwd: ".",
      status: ProcessStatus.ONLINE,
      startedAt: Date.now(),
    });
    kernel.registerService({ name: "demo", processId: "p1", registeredAt: Date.now() });

    const jobs = new JobScheduler({ maxActive: 1 });
    jobs.schedule(createJob({ name: "ok", run: async () => {} }));
    await new Promise((r) => setTimeout(r, 10));

    const permissions = new PermissionManager();
    permissions.grant("p1", [Capability.EXEC]);

    const manager = new SystemManager({ kernel, jobs, permissions });
    const state = manager.snapshot();

    expect(state.processes).toHaveLength(1);
    expect(state.services).toHaveLength(1);
    expect(state.jobs.length).toBeGreaterThanOrEqual(1);
    expect(state.capabilities).toEqual([{ processId: "p1", permitted: ["exec"], effective: ["exec"] }]);
    expect(state.health.overall).toBe("ok");
  });

  it("includes workspace snapshots when a WorkspaceManager is provided", () => {
    const root = makeRepoRoot();
    const workspaces = new WorkspaceManager();
    workspaces.open(root);

    const manager = new SystemManager({ kernel: new Kernel(), workspaces });
    const state = manager.snapshot();

    expect(state.workspaces).toHaveLength(1);
    expect(state.workspaces[0].state.repositoryRoot).toBe(root);
    expect(state.health.components.find((c) => c.name === "workspaces")?.detail).toContain("1 active");
  });

  it("includes configuration entries when a store is provided", () => {
    const configuration = new ConfigurationStore({ defaults: { maxWorkers: 4 } });
    configuration.set("theme", "dark");

    const manager = new SystemManager({ kernel: new Kernel(), configuration });
    expect(manager.snapshot().configuration).toEqual({ theme: "dark" });
  });

  it("job health check flags failed jobs as degraded", async () => {
    const kernel = new Kernel();
    const jobs = new JobScheduler({ maxActive: 1 });
    jobs.schedule(
      createJob({
        name: "bad",
        run: async () => {
          throw new Error("boom");
        },
      })
    );
    await new Promise((r) => setTimeout(r, 10));

    const manager = new SystemManager({ kernel, jobs });
    expect(manager.snapshot().health.overall).toBe("degraded");
  });

  it("custom health checks can be registered after construction", () => {
    const manager = new SystemManager({ kernel: new Kernel() });
    manager.registerHealthCheck("custom", () => ({ ok: false, detail: "warn" }));

    expect(manager.snapshot().health.components.find((c) => c.name === "custom")).toMatchObject({
      status: "degraded",
    });
  });
});
