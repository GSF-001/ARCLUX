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
 * ProcessManager — spawns and tracks real OS processes for ARCLUX's own
 * internal services (web server, watcher, indexer). This is ARCLUX's
 * fork-mode equivalent of PM2's God.forkMode (lib/God/ForkMode.js):
 * child_process.spawn + stdout/stderr capture + exit handling + IPC
 * message forwarding, all broadcast through the kernel's SignalBus
 * (mirrors God.bus.emit('log:out' / 'log:err' / 'process:msg', ...)).
 *
 * Deliberately NOT ported from PM2:
 * - Cluster mode (cluster.fork() for multi-instance load balancing) —
 *   see lib/God/ClusterMode.js in the PM2 reference clone. ARCLUX's
 *   internal services are single-instance; add this later if a real
 *   need for multi-instance load balancing shows up.
 * - Log file persistence to disk, PID file writing, dayjs-formatted
 *   timestamps, JSON log type toggle, uid/gid, Windows-specific options.
 */

import { spawn, type ChildProcess } from "node:child_process";
import type { Kernel } from "../kernel/Kernel";
import { ProcessStatus } from "../kernel/ProcessTable";
import type { ProcessSpec } from "./ProcessSpec";

interface TrackedChild {
  spec: ProcessSpec;
  child: ChildProcess;
}

export class ProcessManager {
  private children = new Map<string, TrackedChild>();

  constructor(private readonly kernel: Kernel) {}

  start(spec: ProcessSpec): void {
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
    const entry = this.kernel.processTable.get(spec.id);
    if (entry) {
      entry.pid = child.pid ?? null;
      entry.startedAt = Date.now();
    }

    child.stdout?.on("data", (data: Buffer) => {
      this.kernel.signalBus.emit("log:out", {
        processId: spec.id,
        name: spec.name,
        data: data.toString(),
        at: Date.now(),
      });
    });

    child.stderr?.on("data", (data: Buffer) => {
      this.kernel.signalBus.emit("log:err", {
        processId: spec.id,
        name: spec.name,
        data: data.toString(),
        at: Date.now(),
      });
    });

    child.on("message", (msg: unknown) => {
      this.kernel.signalBus.emit("process:msg", {
        processId: spec.id,
        name: spec.name,
        data: msg,
        at: Date.now(),
      });
    });

    child.once("exit", (code, signal) => {
      const exitedAbnormally = code !== 0 && code !== null;
      this.kernel.updateProcessStatus(
        spec.id,
        exitedAbnormally ? ProcessStatus.ERRORED : ProcessStatus.STOPPED,
        code ?? undefined
      );
      this.children.delete(spec.id);

      const shouldRestart =
        spec.autorestart !== false &&
        exitedAbnormally &&
        (this.kernel.processTable.get(spec.id)?.restarts ?? 0) <
          (spec.maxRestarts ?? 15); // 15 matches PM2's default unstable_restarts ceiling

      if (shouldRestart) {
        this.kernel.processTable.incrementRestarts(spec.id);
        this.start(spec);
      }
    });

    child.once("error", (err) => {
      this.kernel.signalBus.emit("process:error", {
        processId: spec.id,
        name: spec.name,
        error: err.message,
        at: Date.now(),
      });
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
    return tracked.child.send(message);
  }
}
