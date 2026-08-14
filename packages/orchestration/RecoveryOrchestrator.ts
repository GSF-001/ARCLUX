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
import { TaskOrchestrator, type TaskRun, type TaskStep } from "./TaskOrchestrator";

// Coordinates recovery when a subsystem reports a failure (issue #352).
// The orchestrator subscribes to a failure signal, runs a recovery task
// (a list of steps via TaskOrchestrator), and emits the recovery outcome
// so the failure is visible instead of silently swallowed. Attempts are
// capped to prevent a broken recovery from looping forever; the cap is
// reset on a successful recovery.

export interface RecoveryOrchestratorOptions {
  signalBus: SignalBus;
  /** Max recovery attempts before giving up. Default 3. */
  maxAttempts?: number;
  taskOrchestrator?: TaskOrchestrator;
}

export interface RecoveryConfig {
  /** Signal that triggers recovery (e.g. "daemon:analysis:error"). */
  failureSignal: string;
  /** Human-readable name for the recovery task. */
  name: string;
  /** Steps run to recover from the failure. */
  steps: TaskStep[];
}

export interface RecoveryAttempt {
  configName: string;
  attempts: number;
  lastStatus: "idle" | "recovering" | "succeeded" | "failed";
  lastError?: string;
  lastAt: number | null;
}

export class RecoveryOrchestrator {
  private readonly signalBus: SignalBus;
  private readonly maxAttempts: number;
  private readonly tasks: TaskOrchestrator;
  private readonly attempts = new Map<string, RecoveryAttempt>();
  private unsubscribers: (() => void)[] = [];

  constructor(options: RecoveryOrchestratorOptions) {
    this.signalBus = options.signalBus;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.tasks = options.taskOrchestrator ?? new TaskOrchestrator({ signalBus: this.signalBus });
  }

  /** Registers a recovery for a failure signal. Returns an unsubscribe function. */
  register(config: RecoveryConfig): () => void {
    const handler = () => {
      this.recover(config);
    };
    this.signalBus.on(config.failureSignal, handler);
    const unsubscribe = () => this.signalBus.off(config.failureSignal, handler);
    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  getAttempt(name: string): RecoveryAttempt | undefined {
    return this.attempts.get(name);
  }

  listAttempts(): RecoveryAttempt[] {
    return [...this.attempts.values()];
  }

  private async recover(config: RecoveryConfig): Promise<void> {
    const attempt = this.attempts.get(config.name) ?? {
      configName: config.name,
      attempts: 0,
      lastStatus: "idle" as const,
      lastAt: null,
    };

    if (attempt.lastStatus === "recovering") return; // already in flight
    if (attempt.attempts >= this.maxAttempts) return; // gave up

    attempt.attempts += 1;
    attempt.lastStatus = "recovering";
    attempt.lastAt = Date.now();
    this.attempts.set(config.name, attempt);
    this.signalBus.emit("recovery:started", { name: config.name, attempt: attempt.attempts, at: Date.now() });

    const run: TaskRun = await this.tasks.execute(`${config.name}-recovery-${attempt.attempts}`, config.steps);

    if (run.status === "completed") {
      attempt.lastStatus = "succeeded";
      attempt.attempts = 0; // reset cap on success
      attempt.lastAt = Date.now();
      this.signalBus.emit("recovery:succeeded", { name: config.name, at: Date.now() });
    } else {
      attempt.lastStatus = "failed";
      attempt.lastError = run.steps.find((s) => s.status === "failed")?.error;
      attempt.lastAt = Date.now();
      this.signalBus.emit("recovery:failed", {
        name: config.name,
        attempt: attempt.attempts,
        error: attempt.lastError,
        at: Date.now(),
      });
    }
  }

  /** Removes all registered recoveries and clears in-flight state. */
  dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    this.attempts.clear();
  }
}
