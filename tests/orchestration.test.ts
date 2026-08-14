// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for issue #352: packages/orchestration/ generalizes the wiring
// ArcluxDaemon used to do inline — PlatformOrchestrator turns a
// push-based analysis source into the platform event pipeline,
// EventRouter routes signals declaratively, TaskOrchestrator runs
// multi-step tasks, RecoveryOrchestrator coordinates recovery on failure.

import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { SignalBus } from "../packages/kernel/SignalBus";
import { EventRouter } from "../packages/orchestration/EventRouter";
import { PlatformOrchestrator } from "../packages/orchestration/PlatformOrchestrator";
import { TaskOrchestrator } from "../packages/orchestration/TaskOrchestrator";
import { RecoveryOrchestrator } from "../packages/orchestration/RecoveryOrchestrator";
import { Repository } from "../packages/repository/Repository";
import type { AnalyzeRepositoryResult } from "../packages/engine/pipeline";
import type { DependencyGraph, RepositoryMeta } from "../packages/shared/types";

const meta: RepositoryMeta = {
  id: "local",
  org: "local",
  name: "fixture",
  defaultBranch: "local",
  rootPath: "/virtual/fixture",
  detectedFrameworks: [],
  packageManager: "npm",
  analyzedAt: new Date(0).toISOString(),
};

const emptyGraph: DependencyGraph = {
  repositoryId: "local",
  nodes: [],
  edges: [],
  builtAt: new Date(0).toISOString(),
};

function makeResult(moduleCount: number): AnalyzeRepositoryResult {
  const repository = new Repository(meta);
  return {
    meta,
    moduleCount,
    graph: emptyGraph,
    scanSummary: { filesScanned: 0, filesParsed: 0, filesSkippedNoParser: 0, skippedByExtension: {} },
    repository,
    dependencies: [],
  };
}

/** Minimal push-based source with the same surface as DaemonRepositoryWatcher. */
function makeSource() {
  const emitter = new EventEmitter();
  return {
    emitUpdated: (result: AnalyzeRepositoryResult) => emitter.emit("analysis:updated", result),
    emitError: (err: Error) => emitter.emit("analysis:error", err),
    on: (event: string, handler: (...args: any[]) => void) => emitter.on(event, handler),
    off: (event: string, handler: (...args: any[]) => void) => emitter.off(event, handler),
  };
}

describe("EventRouter (issue #352)", () => {
  it("routes a signal from `from` to `to` with transform", () => {
    const bus = new SignalBus();
    const router = new EventRouter(bus);
    const seen: unknown[] = [];
    bus.on("out", (payload: unknown) => seen.push(payload));

    router.route({ from: "in", to: "out", transform: (n: number) => ({ doubled: n * 2 }) });
    bus.emit("in", 21);

    expect(seen).toEqual([{ doubled: 42 }]);
  });

  it("identity transform when omitted", () => {
    const bus = new SignalBus();
    const router = new EventRouter(bus);
    const seen: unknown[] = [];
    bus.on("out", (payload: unknown) => seen.push(payload));

    router.route({ from: "in", to: "out" });
    bus.emit("in", { x: 1 });

    expect(seen).toEqual([{ x: 1 }]);
  });

  it("routeMany returns a single unsubscribe that removes all routes", () => {
    const bus = new SignalBus();
    const router = new EventRouter(bus);
    const seen: string[] = [];
    bus.on("a", () => seen.push("a"));
    bus.on("b", () => seen.push("b"));

    const unsubscribe = router.routeMany([
      { from: "in1", to: "a" },
      { from: "in2", to: "b" },
    ]);
    bus.emit("in1", 1);
    bus.emit("in2", 2);
    expect(seen).toEqual(["a", "b"]);

    unsubscribe();
    seen.length = 0;
    bus.emit("in1", 1);
    bus.emit("in2", 2);
    expect(seen).toEqual([]);
  });
});

describe("PlatformOrchestrator (issue #352)", () => {
  it("wires analysis:updated to daemon:analysis:updated and daemon:diagnostics:updated", () => {
    const bus = new SignalBus();
    const source = makeSource();
    const orchestrator = new PlatformOrchestrator({ rootPath: "/repo", source, signalBus: bus });
    const analysis: unknown[] = [];
    const diagnostics: unknown[] = [];
    bus.on("daemon:analysis:updated", (p: unknown) => analysis.push(p));
    bus.on("daemon:diagnostics:updated", (p: unknown) => diagnostics.push(p));

    orchestrator.start();
    source.emitUpdated(makeResult(42));

    expect(analysis).toEqual([{ rootPath: "/repo", moduleCount: 42, at: expect.any(Number) }]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ findings: [] });
    orchestrator.stop();
  });

  it("wires analysis:error to daemon:analysis:error", () => {
    const bus = new SignalBus();
    const source = makeSource();
    const orchestrator = new PlatformOrchestrator({ rootPath: "/repo", source, signalBus: bus });
    const errors: unknown[] = [];
    bus.on("daemon:analysis:error", (p: unknown) => errors.push(p));

    orchestrator.start();
    source.emitError(new Error("boom"));

    expect(errors).toEqual([{ message: "boom", at: expect.any(Number) }]);
    orchestrator.stop();
  });

  it("start/stop are idempotent — stop removes listeners", () => {
    const bus = new SignalBus();
    const source = makeSource();
    const orchestrator = new PlatformOrchestrator({ rootPath: "/repo", source, signalBus: bus });
    const analysis: unknown[] = [];
    bus.on("daemon:analysis:updated", (p: unknown) => analysis.push(p));

    orchestrator.start();
    orchestrator.start(); // no double subscription
    source.emitUpdated(makeResult(1));
    expect(analysis).toHaveLength(1);

    orchestrator.stop();
    orchestrator.stop(); // idempotent
    source.emitUpdated(makeResult(2));
    expect(analysis).toHaveLength(1);
  });
});

describe("TaskOrchestrator (issue #352)", () => {
  it("runs steps in order and completes", async () => {
    const bus = new SignalBus();
    const orchestrator = new TaskOrchestrator({ signalBus: bus });
    const order: string[] = [];

    const run = await orchestrator.execute("demo", [
      { name: "a", run: () => void order.push("a") },
      { name: "b", run: () => void order.push("b") },
    ]);

    expect(order).toEqual(["a", "b"]);
    expect(run.status).toBe("completed");
    expect(run.steps.map((s) => s.status)).toEqual(["done", "done"]);
    expect(run.finishedAt).not.toBeNull();
  });

  it("stops at the first failing step and records the error", async () => {
    const bus = new SignalBus();
    const orchestrator = new TaskOrchestrator({ signalBus: bus });
    const order: string[] = [];

    const run = await orchestrator.execute("demo", [
      { name: "ok", run: () => void order.push("ok") },
      {
        name: "boom",
        run: () => {
          order.push("boom");
          throw new Error("step failed");
        },
      },
      { name: "never", run: () => void order.push("never") },
    ]);

    expect(order).toEqual(["ok", "boom"]);
    expect(run.status).toBe("failed");
    expect(run.steps[1]).toMatchObject({ status: "failed", error: "step failed" });
    expect(run.steps[2]).toMatchObject({ status: "pending" });
  });

  it("emits task:started / task:completed on the signal bus", async () => {
    const bus = new SignalBus();
    const orchestrator = new TaskOrchestrator({ signalBus: bus });
    const events: string[] = [];
    bus.on("task:started", () => events.push("started"));
    bus.on("task:completed", () => events.push("completed"));
    bus.on("task:failed", () => events.push("failed"));

    await orchestrator.execute("demo", [{ name: "a", run: () => {} }]);

    expect(events).toEqual(["started", "completed"]);
  });
});

describe("RecoveryOrchestrator (issue #352)", () => {
  it("runs recovery steps when the failure signal fires", async () => {
    const bus = new SignalBus();
    const orchestrator = new RecoveryOrchestrator({ signalBus: bus });
    const recovered: boolean[] = [];
    orchestrator.register({
      failureSignal: "daemon:analysis:error",
      name: "reanalyze",
      steps: [
        {
          name: "recover",
          run: () => {
            recovered.push(true);
          },
        },
      ],
    });

    bus.emit("daemon:analysis:error", { message: "x", at: 1 });
    // recover is async — wait for the attempt to settle, not just the step to run.
    await vi.waitFor(() => {
      expect(orchestrator.getAttempt("reanalyze")?.lastStatus).toBe("succeeded");
    });

    expect(recovered).toEqual([true]);
  });

  it("caps attempts at maxAttempts and gives up", async () => {
    const bus = new SignalBus();
    const orchestrator = new RecoveryOrchestrator({ signalBus: bus, maxAttempts: 2 });
    let attempts = 0;
    orchestrator.register({
      failureSignal: "srv:error",
      name: "restart",
      steps: [
        {
          name: "restart",
          run: () => {
            attempts += 1;
            throw new Error("still down");
          },
        },
      ],
    });

    // Emit, wait for the attempt to settle, then emit again — recovery is
    // guarded against overlapping runs, so sync emits would collapse.
    const settle = () =>
      vi.waitFor(() => {
        expect(orchestrator.getAttempt("restart")?.lastStatus).not.toBe("recovering");
      });

    bus.emit("srv:error", { message: "1", at: 1 });
    await settle();
    bus.emit("srv:error", { message: "2", at: 2 });
    await settle();
    bus.emit("srv:error", { message: "3", at: 3 });
    await settle();

    expect(attempts).toBe(2);
    const attempt = orchestrator.getAttempt("restart");
    expect(attempt?.lastStatus).toBe("failed");
    expect(attempt?.lastError).toBe("still down");
  });

  it("resets the attempt cap after a successful recovery", async () => {
    const bus = new SignalBus();
    const orchestrator = new RecoveryOrchestrator({ signalBus: bus, maxAttempts: 2 });
    let fails = 0;
    orchestrator.register({
      failureSignal: "srv:error",
      name: "retry-once",
      steps: [
        {
          name: "maybe",
          run: () => {
            fails += 1;
            if (fails === 1) throw new Error("first time");
            // second recovery succeeds
          },
        },
      ],
    });

    const settle = () =>
      vi.waitFor(() => {
        expect(orchestrator.getAttempt("retry-once")?.lastStatus).not.toBe("recovering");
      });

    bus.emit("srv:error", { message: "1", at: 1 });
    await settle();
    expect(orchestrator.getAttempt("retry-once")?.lastStatus).toBe("failed");

    // Second failure is still allowed (attempts 1 < maxAttempts 2), and
    // succeeding resets the counter back to zero for future failures.
    bus.emit("srv:error", { message: "2", at: 2 });
    await settle();
    expect(orchestrator.getAttempt("retry-once")?.lastStatus).toBe("succeeded");
    expect(orchestrator.getAttempt("retry-once")?.attempts).toBe(0);

    expect(fails).toBe(2);
  });
});
