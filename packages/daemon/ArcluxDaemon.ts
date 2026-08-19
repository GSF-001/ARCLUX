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
import { findFreePort } from "../networking/PortManager";
import { createServiceEndpoint, writeServiceEndpoint, removeServiceEndpoint } from "../networking/ServiceEndpoint";
import { startLocalBridgeServer, type LocalBridgeServer } from "./LocalBridgeServer";
import { computeDaemonId } from "./DaemonProcess";
import { NotificationManager } from "../notifications/NotificationManager";
import type { NotificationChannel } from "../notifications/NotificationChannel";
import { PlatformOrchestrator } from "../orchestration/PlatformOrchestrator";
import { calculateAffectedFiles } from "../impact/calculateAffectedFiles";

export interface ArcluxDaemonOptions {
  rootPath: string;
  /**
   * Channels to fan daemon diagnostic events out to. Registered on the
   * daemon's NotificationManager (daemon.notifications) before start() —
   * see packages/notifications/ for the interface and a console reference
   * implementation. Optional: without channels the daemon still analyzes
   * and emits, just nobody receives notifications.
   */
  notificationChannels?: NotificationChannel[];
}

export interface ImpactQueryResult {
  ok: boolean;
  file: string;
  moduleId?: string;
  error?: string;
  suggestions?: string[];
  consumers?: string[];
  directConsumers?: number;
  affected?: { moduleId: string; filePath: string; distance: number }[];
  totalAffected?: number;
}

export class ArcluxDaemon {
  readonly kernel = new Kernel();
  /** Fans daemon:diagnostics:updated events to registered channels. */
  readonly notifications: NotificationManager;
  /** Generalizes the watcher→analysis→diagnostics wiring (issue #352). */
  private orchestrator: PlatformOrchestrator | null = null;
  private watcher: DaemonRepositoryWatcher | null = null;
  private bridgeServer: LocalBridgeServer | null = null;
  private readonly daemonId: string;
  private readonly rootPath: string;

  constructor(options: ArcluxDaemonOptions) {
    this.rootPath = options.rootPath;
    // Stable id derived from rootPath, so restarting the daemon on the same
    // repo reuses the same endpoint file instead of accumulating stale ones.
    this.daemonId = computeDaemonId(this.rootPath);
    this.notifications = new NotificationManager(this.kernel.signalBus);
    for (const channel of options.notificationChannels ?? []) {
      this.notifications.registerChannel(channel);
    }
  }

  /** Delegates to the underlying DaemonRepositoryWatcher -- see LocalBridgeServer.ts's GET /analysis. */
  async getAnalysis() {
    if (!this.watcher) throw new Error("daemon not started");
    return this.watcher.getAnalysis();
  }

  /**
   * Impact analysis for one file, computed live from the in-memory
   * repository: direct consumers (importers) plus the transitive
   * affected set (calculateAffectedFiles). Serves GET /impact?file=.
   */
  async getImpact(filePath: string): Promise<ImpactQueryResult> {
    if (!this.watcher) throw new Error("daemon not started");
    const result = await this.watcher.getAnalysis();
    const repository = result.repository;

    const module = repository
      .getAllModules()
      .find((m) => m.file.relativePath === filePath || m.file.relativePath.endsWith(`/${filePath}`));
    if (!module) {
      return {
        ok: false,
        file: filePath,
        error: `module not found: ${filePath}`,
        suggestions: repository
          .getAllModules()
          .map((m) => m.file.relativePath)
          .filter((p) => p.toLowerCase().includes(filePath.toLowerCase()))
          .slice(0, 5),
      };
    }

    const impact = calculateAffectedFiles(repository, module.id);
    return {
      ok: true,
      file: module.file.relativePath,
      moduleId: module.id,
      consumers: module.importedBy.map((id) => repository.getModule(id)?.file.relativePath ?? id),
      directConsumers: module.importedBy.length,
      affected: impact.affectedFiles,
      totalAffected: impact.totalAffected,
    };
  }

  start(): void {
    if (this.watcher) return;

    // Subscribe before the first analysis can emit, so no diagnostics run
    // is missed by channels. Idempotent in NotificationManager itself.
    this.notifications.start();

    this.watcher = new DaemonRepositoryWatcher(this.rootPath);
    this.orchestrator = new PlatformOrchestrator({
      rootPath: this.rootPath,
      source: this.watcher,
      signalBus: this.kernel.signalBus,
    });
    this.orchestrator.start();

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
    // Unsubscribe first so a final diagnostics event can't reach channels
    // while the watcher is already tearing down.
    this.notifications.stop();
    this.orchestrator?.stop();
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
