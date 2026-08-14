// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { spawn, type ChildProcess } from "node:child_process";
import type { Kernel } from "../kernel/Kernel";
import { ProcessStatus } from "../kernel/ProcessTable";
import type { ProcessSpec } from "./ProcessSpec";
import { JobScheduler } from "../scheduler/JobScheduler";
import { createJob } from "../scheduler/Job";
import { Sandbox } from "../security/Sandbox";
import { PermissionManager } from "../security/PermissionManager";
import { Capability } from "../security/Capability";

interface TrackedChild {
  spec: ProcessSpec;
  child: ChildProcess;
}

export class ProcessManager {
  private children = new Map<string, TrackedChild>();
  // Restart jobs go through JobScheduler with exponential backoff, instead of
  // restarting instantly, to avoid crash-loop (a process erroring every <1s
  // would otherwise busy-loop restart attempts). Pattern from Linux workqueue's
  // delayed_work, see packages/scheduler/Job.ts.
  private restartScheduler = new JobScheduler({ maxActive: 1 });
  // Enforces capability checks before a process is allowed to spawn.
  // See packages/security/Sandbox.ts -- ported from Linux capability.h's
  // granular-permission model.
  readonly permissions = new PermissionManager();
  private sandbox = new Sandbox(this.permissions);

  constructor(private readonly kernel: Kernel) {}

  start(spec: ProcessSpec): void {
    // Grant default capabilities on first start. Callers wanting a tighter
    // policy should call this.permissions.grant() themselves BEFORE start().
    if (!this.permissions.getCapabilitySet(spec.id)) {
      this.permissions.grant(spec.id, [Capability.EXEC, Capability.ENV_WRITE, Capability.IPC_SEND, Capability.PROCESS_KILL]);
    }
    this.sandbox.enforce(spec);

    this.kernel.registerProcess({
      id: spec.id,
      pid: null,
      name: spec.name,
      command: spec.command,
      args: spec.args ?? [],
      cwd: spec.cwd ?? process.cwd(),
      status: ProcessStatus.LAUNCHING,
      startedAt: null,
    });

    const child = spawn(spec.command, spec.args ?? [], {
      cwd: spec.cwd ?? process.cwd(),
      env: { ...process.env, ...spec.env },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    this.children.set(spec.id, { spec, child });
    this.kernel.updateProcessStatus(spec.id, ProcessStatus.ONLINE);
    this.kernel.setProcessRuntimeInfo(spec.id, { pid: child.pid ?? null, startedAt: Date.now() });

    child.stdout?.on("data", (data: Buffer) => {
      this.kernel.signalBus.emit("log:out", { processId: spec.id, name: spec.name, data: data.toString(), at: Date.now() });
    });

    child.stderr?.on("data", (data: Buffer) => {
      this.kernel.signalBus.emit("log:err", { processId: spec.id, name: spec.name, data: data.toString(), at: Date.now() });
    });

    child.on("message", (msg: unknown) => {
      this.kernel.signalBus.emit("process:msg", { processId: spec.id, name: spec.name, data: msg, at: Date.now() });
    });

    child.once("exit", (code, signal) => {
      const exitedAbnormally = code !== 0 && code !== null;
      this.kernel.updateProcessStatus(spec.id, exitedAbnormally ? ProcessStatus.ERRORED : ProcessStatus.STOPPED, code ?? undefined);
      this.children.delete(spec.id);

      const shouldRestart =
        spec.autorestart !== false &&
        exitedAbnormally &&
        (this.kernel.processTable.get(spec.id)?.restarts ?? 0) < (spec.maxRestarts ?? 15);

      if (shouldRestart) {
        this.kernel.processTable.incrementRestarts(spec.id);
        const restartCount = this.kernel.processTable.get(spec.id)?.restarts ?? 1;
        // Exponential backoff: 1s, 2s, 4s, 8s... capped at 30s.
        const delayMs = Math.min(30_000, 1_000 * 2 ** (restartCount - 1));
        this.restartScheduler.schedule(
          createJob({
            name: `restart:${spec.name}`,
            delayMs,
            run: async () => {
              this.start(spec);
            },
          })
        );
      }
    });

    child.once("error", (err) => {
      this.kernel.signalBus.emit("process:error", { processId: spec.id, name: spec.name, error: err.message, at: Date.now() });
    });
  }

  stop(id: string): void {
    const tracked = this.children.get(id);
    if (!tracked) return;
    this.kernel.updateProcessStatus(id, ProcessStatus.STOPPING);
    tracked.child.kill("SIGINT");
  }

  send(id: string, message: unknown): boolean {
    const tracked = this.children.get(id);
    if (!tracked || !tracked.child.connected) return false;
    return tracked.child.send(message as any);
  }
}
