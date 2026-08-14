/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { SignalBus } from "../kernel/SignalBus";
import type { AnalyzeRepositoryResult } from "../engine/pipeline";
import { runDiagnostics } from "../diagnostics/DiagnosticEngine";

// The glue layer (issue #352): turns a push-based analysis source (the
// daemon's repository watcher) into the platform-wide event pipeline
// (analysis → diagnostics) on the kernel SignalBus. Generalizes the wiring
// that ArcluxDaemon used to do inline: a new subsystem plugs its source
// into a PlatformOrchestrator instead of hand-subscribing to every signal
// name itself. The emitted event names/payload shapes are identical to
// what the daemon emitted before, so existing subscribers (apps/cli,
// LocalBridgeServer, NotificationManager) keep working unchanged.

export interface AnalysisEventSource {
  on(event: "analysis:updated", handler: (result: AnalyzeRepositoryResult) => void): void;
  on(event: "analysis:error", handler: (err: Error) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

export interface PlatformOrchestratorOptions {
  rootPath: string;
  source: AnalysisEventSource;
  signalBus: SignalBus;
}

export class PlatformOrchestrator {
  private readonly sourceHandler = {
    updated: (result: AnalyzeRepositoryResult) => {
      const { rootPath, signalBus } = this.options;
      signalBus.emit("daemon:analysis:updated", {
        rootPath,
        moduleCount: result.moduleCount,
        at: Date.now(),
      });

      // Re-run the wired diagnostic adapters (packages/diagnostics/DiagnosticEngine.ts)
      // on every fresh analysis, so a subscriber gets errors as they appear,
      // not just graph/module counts.
      const findings = runDiagnostics(result.repository);
      signalBus.emit("daemon:diagnostics:updated", { findings, at: Date.now() });
    },
    error: (err: Error) => {
      this.options.signalBus.emit("daemon:analysis:error", {
        message: err.message,
        at: Date.now(),
      });
    },
  };

  private started = false;

  constructor(private readonly options: PlatformOrchestratorOptions) {}

  /** Wires the source events onto the signal bus. Idempotent. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.options.source.on("analysis:updated", this.sourceHandler.updated);
    this.options.source.on("analysis:error", this.sourceHandler.error);
  }

  /** Removes all routes from the signal bus. Idempotent. */
  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.options.source.off("analysis:updated", this.sourceHandler.updated);
    this.options.source.off("analysis:error", this.sourceHandler.error);
  }
}
