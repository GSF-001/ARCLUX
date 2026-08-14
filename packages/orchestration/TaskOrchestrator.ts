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

// Coordinates multi-step tasks (issue #352): runs a list of steps in
// order, records per-step state, and stops at the first failure so a
// broken step can't silently leave later steps half-run. The terminal
// states (all done / failed at step N) are emitted on the signal bus so
// orchestrator consumers (recovery, UI) can react without polling.
//
// The failure payload mirrors what ProcessManager emits on
// `process:error` (processId/error shape) so recovery wiring reads the
// same way across subsystems.

export interface TaskStep {
  name: string;
  run: () => Promise<void> | void;
}

export type TaskStepStatus = "pending" | "running" | "done" | "failed";
export type TaskStatus = "running" | "completed" | "failed";

export interface TaskStepState {
  name: string;
  status: TaskStepStatus;
  error?: string;
}

export interface TaskRun {
  id: string;
  name: string;
  status: TaskStatus;
  steps: TaskStepState[];
  startedAt: number;
  finishedAt: number | null;
}

export interface TaskOrchestratorOptions {
  signalBus: SignalBus;
  taskId?: () => string;
}

let taskCounter = 0;

export class TaskOrchestrator {
  private readonly signalBus: SignalBus;
  private readonly taskId: () => string;
  private runs = new Map<string, TaskRun>();

  constructor(options: TaskOrchestratorOptions) {
    this.signalBus = options.signalBus;
    this.taskId =
      options.taskId ??
      (() => {
        taskCounter += 1;
        return `task-${Date.now()}-${taskCounter}`;
      });
  }

  /** Runs steps in order; returns the final TaskRun (completed or failed at step N). */
  async execute(name: string, steps: TaskStep[]): Promise<TaskRun> {
    const id = this.taskId();
    const run: TaskRun = {
      id,
      name,
      status: "running",
      steps: steps.map((step) => ({ name: step.name, status: "pending" })),
      startedAt: Date.now(),
      finishedAt: null,
    };
    this.runs.set(id, run);
    this.signalBus.emit("task:started", { id, name, at: Date.now() });

    for (let i = 0; i < steps.length; i++) {
      const state = run.steps[i]!;
      state.status = "running";
      try {
        await steps[i]!.run();
        state.status = "done";
        this.signalBus.emit("task:step:done", { id, step: steps[i]!.name, at: Date.now() });
      } catch (err) {
        state.status = "failed";
        state.error = err instanceof Error ? err.message : String(err);
        run.status = "failed";
        run.finishedAt = Date.now();
        this.signalBus.emit("task:failed", {
          id,
          step: steps[i]!.name,
          error: state.error,
          at: Date.now(),
        });
        return run;
      }
    }

    run.status = "completed";
    run.finishedAt = Date.now();
    this.signalBus.emit("task:completed", { id, name, at: Date.now() });
    return run;
  }

  get(id: string): TaskRun | undefined {
    return this.runs.get(id);
  }

  list(): TaskRun[] {
    return [...this.runs.values()];
  }
}
