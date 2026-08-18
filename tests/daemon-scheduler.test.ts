// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the scheduler→daemon wiring (issue: daemon re-analysis hammer).
// Covers the two halves of the change:
//   1. JobScheduler's delayed-drain gap fix — a delayed job (delayMs /
//      notBefore) now actually runs once its delay expires, instead of
//      sitting in the queue forever because nothing re-triggers drain().
//   2. DaemonRepositoryWatcher routing every analysis trigger through the
//      scheduler: change bursts coalesce (workqueue "already pending"),
//      analyses never overlap (max_active=1), and direct getAnalysis()
//      polls serialize behind an in-flight re-index instead of duplicating
//      it.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EventEmitter } from "node:events";
import { JobScheduler } from "../packages/scheduler/JobScheduler";
import { createJob } from "../packages/scheduler/Job";
import { JobStatus } from "../packages/scheduler/JobState";
import { DaemonRepositoryWatcher } from "../packages/daemon/DaemonRepositoryWatcher";
import type { RepositoryWatcher } from "../packages/watcher/watchRepository";
import type { AnalyzeRepositoryResult } from "../packages/engine/pipeline";

// ── helpers ──────────────────────────────────────────────────────────

const RESULT = { moduleCount: 1, meta: { id: "fake" } } as unknown as AnalyzeRepositoryResult;

interface FakeInner extends RepositoryWatcher {
  calls(): number;
  maxOverlap(): number;
  parkedCount(): number;
  releaseNext(): void;
  releaseAll(): void;
  close: ReturnType<typeof vi.fn>;
}

/**
 * Controllable stand-in for watchRepository(). In auto mode (gated:
 * false) every getAnalysis() resolves immediately; in gated mode each
 * call parks on a promise the test releases, so tests can hold an
 * analysis in-flight and observe what happens while it runs.
 */
function createFakeInner(gated = false): FakeInner {
  let callCount = 0;
  let inFlight = 0;
  let peakOverlap = 0;
  const parked: Array<() => void> = [];

  return {
    getAnalysis(): Promise<AnalyzeRepositoryResult> {
      callCount += 1;
      inFlight += 1;
      peakOverlap = Math.max(peakOverlap, inFlight);
      return new Promise((resolve) => {
        const finish = () => {
          inFlight -= 1;
          resolve(RESULT);
        };
        if (gated) parked.push(finish);
        else finish();
      });
    },
    calls: () => callCount,
    maxOverlap: () => peakOverlap,
    parkedCount: () => parked.length,
    releaseNext: () => parked.shift()?.(),
    releaseAll: () => {
      while (parked.length) parked.shift()!();
    },
    close: vi.fn(async () => {}),
  };
}

/**
 * Releases every parked analysis as it appears until none remain. Needed
 * because gated analyses chain: releasing job N lets the scheduler start
 * job N+1, which parks again — so "release what is parked right now" must
 * loop with microtask yields in between.
 */
async function releaseUntilIdle(inner: FakeInner): Promise<void> {
  for (let i = 0; i < 10; i++) {
    if (inner.parkedCount() === 0) break;
    inner.releaseAll();
    await new Promise((r) => setImmediate(r));
  }
}

function waitForEvents(emitter: EventEmitter, event: string, count: number, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    let seen = 0;
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for ${count} "${event}" event(s)`)),
      timeoutMs
    );
    emitter.on(event, () => {
      seen += 1;
      if (seen === count) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

// ── JobScheduler: delayed jobs must eventually run ───────────────────

describe("JobScheduler delayed-drain gap", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs a delayed job once its notBefore passes, without any other schedule() call", async () => {
    const scheduler = new JobScheduler({ maxActive: 1 });
    const runs: string[] = [];

    const job = createJob({
      name: "deferred",
      delayMs: 500,
      run: async () => {
        runs.push("deferred");
      },
    });
    scheduler.schedule(job);

    // Queued as DELAYED, not yet runnable.
    expect(scheduler.getState(job.id)?.status).toBe(JobStatus.DELAYED);
    expect(runs).toEqual([]);

    // Before the delay elapses nothing runs — and (the pre-fix bug) after
    // it elapses, nothing would EVER run without the drain timer.
    await vi.advanceTimersByTimeAsync(499);
    expect(runs).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toEqual(["deferred"]);
    expect(scheduler.getState(job.id)?.status).toBe(JobStatus.DONE);
  });

  it("runs an immediate job first, then a delayed one after its delay, in order", async () => {
    const scheduler = new JobScheduler({ maxActive: 1, ordered: true });
    const runs: string[] = [];

    scheduler.schedule(
      createJob({
        name: "now",
        run: async () => {
          runs.push("now");
        },
      })
    );
    scheduler.schedule(
      createJob({
        name: "later",
        delayMs: 300,
        run: async () => {
          runs.push("later");
        },
      })
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(runs).toEqual(["now"]);

    await vi.advanceTimersByTimeAsync(299);
    expect(runs).toEqual(["now"]);

    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toEqual(["now", "later"]);
  });
});

// ── DaemonRepositoryWatcher: coalescing + max_active=1 ───────────────

describe("DaemonRepositoryWatcher scheduler wiring", () => {
  afterEach(() => vi.useRealTimers());

  it("coalesces a burst of change flushes into a single running + single queued analysis", async () => {
    const inner = createFakeInner();
    const watcher = new DaemonRepositoryWatcher("/repo", { inner });

    watcher.scheduleAnalysis();
    watcher.scheduleAnalysis();
    watcher.scheduleAnalysis();
    watcher.scheduleAnalysis();
    watcher.scheduleAnalysis();

    // 5 triggers: first runs, one follow-up queues behind it, the rest
    // coalesce away (already-pending work is not requeued).
    await waitForEvents(watcher, "analysis:updated", 2);
    expect(inner.calls()).toBe(2);
    expect(inner.maxOverlap()).toBe(1);

    await watcher.close();
  });

  it("never starts an overlapping analysis: flushes during an in-flight analysis serialize behind it", async () => {
    const inner = createFakeInner(true); // gated: hold the first analysis open
    const watcher = new DaemonRepositoryWatcher("/repo", { inner });

    watcher.scheduleAnalysis(); // job 1 starts, parks on the gate
    await new Promise((r) => setImmediate(r));
    expect(inner.calls()).toBe(1);
    expect(inner.maxOverlap()).toBe(1);

    // 5 change batches arrive while job 1 is still running.
    watcher.scheduleAnalysis();
    watcher.scheduleAnalysis();
    watcher.scheduleAnalysis();
    watcher.scheduleAnalysis();
    watcher.scheduleAnalysis();
    await new Promise((r) => setImmediate(r));

    // Only one follow-up job exists; none of the five started a second
    // analysis while job 1 was in flight.
    expect(inner.calls()).toBe(1);

    const bothEmitted = waitForEvents(watcher, "analysis:updated", 2);
    await releaseUntilIdle(inner);
    await bothEmitted;

    expect(inner.calls()).toBe(2);
    expect(inner.maxOverlap()).toBe(1);

    await watcher.close();
  });

  it("routes direct getAnalysis() polls through the scheduler, serializing behind an in-flight analysis", async () => {
    const inner = createFakeInner(true);
    const watcher = new DaemonRepositoryWatcher("/repo", { inner });

    const first = watcher.getAnalysis();
    const second = watcher.getAnalysis();
    const third = watcher.getAnalysis();

    // All three are parked on the scheduler (max_active=1): no second
    // analysis started while the first is in flight.
    expect(inner.calls()).toBe(1);
    expect(inner.maxOverlap()).toBe(1);

    const allResolved = Promise.all([first, second, third]);
    await releaseUntilIdle(inner);
    await allResolved;

    expect(inner.calls()).toBe(3);
    expect(inner.maxOverlap()).toBe(1);

    await watcher.close();
  });

  it("emits analysis:error when the underlying analysis fails", async () => {
    const inner = {
      getAnalysis: vi.fn(async () => {
        throw new Error("reindex exploded");
      }),
      close: vi.fn(async () => {}),
    };
    const watcher = new DaemonRepositoryWatcher("/repo", { inner: inner as unknown as RepositoryWatcher });

    const errored = waitForEvents(watcher, "analysis:error", 1);
    watcher.scheduleAnalysis();
    await errored;

    expect(inner.getAnalysis).toHaveBeenCalledTimes(1);
    await watcher.close();
  });

  it("close() tears down the fs watcher, change queue, and inner watcher", async () => {
    const inner = createFakeInner();
    const watcher = new DaemonRepositoryWatcher("/repo", { inner });

    await watcher.close();
    expect(inner.close).toHaveBeenCalledTimes(1);
  });
});