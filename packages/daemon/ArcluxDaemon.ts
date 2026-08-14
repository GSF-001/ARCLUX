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
import { findFreePort } from "../networking/PortManager";
import { createServiceEndpoint, writeServiceEndpoint, removeServiceEndpoint } from "../networking/ServiceEndpoint";
import { startLocalBridgeServer, type LocalBridgeServer } from "./LocalBridgeServer";
import { createHash } from "node:crypto";

export interface ArcluxDaemonOptions {
  rootPath: string;
}

export class ArcluxDaemon {
  readonly kernel = new Kernel();
  private watcher: DaemonRepositoryWatcher | null = null;
  private bridgeServer: LocalBridgeServer | null = null;
  private readonly daemonId: string;
  private readonly rootPath: string;

  constructor(options: ArcluxDaemonOptions) {
    this.rootPath = options.rootPath;
    // Stable id derived from rootPath, so restarting the daemon on the same
    // repo reuses the same endpoint file instead of accumulating stale ones.
    this.daemonId = createHash("sha1").update(this.rootPath).digest("hex").slice(0, 12);
  }

  /** Delegates to the underlying DaemonRepositoryWatcher -- see LocalBridgeServer.ts's GET /analysis. */
  async getAnalysis() {
    if (!this.watcher) throw new Error("daemon not started");
    return this.watcher.getAnalysis();
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

    findFreePort()
      .then((port) => startLocalBridgeServer(this, port))
      .then((server) => {
        this.bridgeServer = server;
        const endpoint = createServiceEndpoint(server.port);
        writeServiceEndpoint(this.daemonId, endpoint);
        this.kernel.signalBus.emit("daemon:bridge:listening", { ...endpoint, at: Date.now() });
      })
      .catch((err) => {
        this.kernel.signalBus.emit("daemon:bridge:error", { message: err instanceof Error ? err.message : String(err), at: Date.now() });
      });

    this.kernel.signalBus.emit("daemon:started", { rootPath: this.rootPath, at: Date.now() });
  }

  async stop(): Promise<void> {
    if (!this.watcher) return;
    if (this.bridgeServer) {
      await this.bridgeServer.close();
      this.bridgeServer = null;
    }
    removeServiceEndpoint(this.daemonId);
    await this.watcher.close();
    this.watcher = null;
    this.kernel.signalBus.emit("daemon:stopped", { rootPath: this.rootPath, at: Date.now() });
    this.kernel.shutdown();
  }
}
