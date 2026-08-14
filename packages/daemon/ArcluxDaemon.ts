// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// The long-running process: "install once, ARCLUX stays alive, developer
// just codes". Wires DaemonRepositoryWatcher (push-based re-analysis) to
// Kernel's SignalBus (packages/kernel/Kernel.ts) so other subsystems
// (diagnostics, notifications) can subscribe without knowing about the
// watcher directly -- mirrors how ProcessManager already emits onto
// kernel.signalBus rather than exposing its own separate event API.
// Does not reimplement watching/analysis -- wraps existing pieces.

import { Kernel } from "../kernel/Kernel";
import { DaemonRepositoryWatcher } from "./DaemonRepositoryWatcher";
import { runDiagnostics } from "../diagnostics/DiagnosticEngine";

export interface ArcluxDaemonOptions {
  rootPath: string;
}

export class ArcluxDaemon {
  readonly kernel = new Kernel();
  private watcher: DaemonRepositoryWatcher | null = null;
  private readonly rootPath: string;

  constructor(options: ArcluxDaemonOptions) {
    this.rootPath = options.rootPath;
  }

  start(): void {
    if (this.watcher) return;

    this.watcher = new DaemonRepositoryWatcher(this.rootPath);

    this.watcher.on("analysis:updated", (result) => {
      this.kernel.signalBus.emit("daemon:analysis:updated", {
        rootPath: this.rootPath,
        moduleCount: result.moduleCount,
        at: Date.now(),
      });

      // Re-run the wired diagnostic adapters (packages/diagnostics/DiagnosticEngine.ts)
      // on every fresh analysis, so a subscriber gets errors as they appear,
      // not just graph/module counts.
      const findings = runDiagnostics(result.repository);
      this.kernel.signalBus.emit("daemon:diagnostics:updated", { findings, at: Date.now() });
    });

    this.watcher.on("analysis:error", (err) => {
      this.kernel.signalBus.emit("daemon:analysis:error", { message: err.message, at: Date.now() });
    });

    this.kernel.signalBus.emit("daemon:started", { rootPath: this.rootPath, at: Date.now() });
  }

  async stop(): Promise<void> {
    if (!this.watcher) return;
    await this.watcher.close();
    this.watcher = null;
    this.kernel.signalBus.emit("daemon:stopped", { rootPath: this.rootPath, at: Date.now() });
    this.kernel.shutdown();
  }
}
