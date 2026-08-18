// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Adds a push-based event on top of packages/watcher/watchRepository.ts,
// which is pull-only by design (see its own header comment + PROGRES.md
// decisions entry). Does not change watchRepository.ts's behavior --
// wraps it, calling getAnalysis() once per flushed change batch so
// consumers (daemon, future IDE bridge) can subscribe instead of polling.
//
// Every analysis trigger runs through a JobScheduler (packages/scheduler,
// pattern-ported from Linux kernel/workqueue.c) instead of firing
// directly:
//
//   - Coalescing ("already pending work is not requeued" -- queue_work()
//     in workqueue.c): a change batch that arrives while an analysis job
//     is already waiting does NOT schedule a second one. getAnalysis()
//     is state-based (revision token in watchRepository.ts), so the
//     pending job reads the newest state when it actually runs -- N
//     change batches collapse into one re-analysis.
//   - max_active=1 (workqueue's max_active): at most one full re-index
//     runs at a time. Without this, a change batch arriving mid-analysis
//     (or a GET /analysis poll during a re-index) starts a SECOND,
//     overlapping buildIndex() -- duplicate work on the hot path.
//   - ordered (workqueue's "ordered" attrs): queued analyses run in
//     FIFO order, so a re-analysis triggered during an in-flight one
//     always sees the newest state rather than racing it.
//
// The Linux concepts deliberately NOT ported: per-CPU worker pools, NUMA
// affinity, work_struct bit packing -- single-process Node scheduler has
// none of those problems (see JobScheduler.ts's header for the same call).

import { EventEmitter } from "node:events";
import { watchRepository, type RepositoryWatcher } from "../watcher/watchRepository";
import { watchFilesystem, type FilesystemWatcher } from "../watcher/watchFilesystem";
import { createChangeQueue, type ChangeQueue } from "../watcher/changeQueue";
import { JobScheduler } from "../scheduler/JobScheduler";
import { createJob } from "../scheduler/Job";
import { JobStatus } from "../scheduler/JobState";
import type { AnalyzeRepositoryResult } from "../engine/pipeline";

export interface DaemonRepositoryEvents {
  "analysis:updated": [AnalyzeRepositoryResult];
  "analysis:error": [Error];
}

export interface DaemonRepositoryWatcherOptions {
  /**
   * Injectable for tests; defaults to watchRepository(rootPath). The
   * scheduler wrapping is identical either way.
   */
  inner?: RepositoryWatcher;
  /**
   * Cap on concurrent analyses, mirrors workqueue's max_active. Defaults
   * to 1 -- full re-indexes must never overlap.
   */
  maxActive?: number;
}

/**
 * Wraps watchRepository() + its own separate filesystem watcher/queue to
 * push "analysis:updated" whenever a change batch flushes, instead of
 * requiring the caller to poll getAnalysis(). Runs a SECOND watcher on the
 * same rootPath rather than modifying watchRepository.ts itself, keeping
 * that module's pull-only contract intact for existing callers (e.g. the
 * `work` command) while this one adds push on top. All analysis work is
 * serialized + coalesced through a JobScheduler -- see the header comment.
 */
export class DaemonRepositoryWatcher extends EventEmitter {
  private readonly inner: RepositoryWatcher;
  private readonly scheduler: JobScheduler;
  private readonly pushFsWatcher: FilesystemWatcher;
  private readonly pushQueue: ChangeQueue;

  constructor(private readonly rootPath: string, options: DaemonRepositoryWatcherOptions = {}) {
    super();
    this.inner = options.inner ?? watchRepository(rootPath);
    this.scheduler = new JobScheduler({ maxActive: options.maxActive ?? 1, ordered: true });

    this.pushQueue = createChangeQueue(() => {
      this.scheduleAnalysis();
    });

    this.pushFsWatcher = watchFilesystem(rootPath, (event) => {
      this.pushQueue.push(event);
    });
  }

  /**
   * Coalesced re-analysis, one per change burst (workqueue pattern:
   * queue_work() returns false when the work item is already pending).
   * If an analysis job is already waiting in the scheduler, a new change
   * batch does NOT schedule another one -- the pending job picks up the
   * newest state when it runs. Public so callers (the daemon bridge, a
   * future "re-analyze now" endpoint) can trigger the same coalesced path
   * programmatically instead of hand-subscribing to the scheduler.
   */
  scheduleAnalysis(): void {
    const states = this.scheduler.list();
    const alreadyPending = states.some(
      (s) => s.status === JobStatus.PENDING || s.status === JobStatus.DELAYED
    );
    if (alreadyPending) return;

    const job = createJob({
      name: `re-analyze:${this.rootPath}`,
      run: async () => {
        try {
          const result = await this.inner.getAnalysis();
          this.emit("analysis:updated", result);
        } catch (err) {
          this.emit("analysis:error", err instanceof Error ? err : new Error(String(err)));
        }
      },
    });
    this.scheduler.schedule(job);
  }

  /**
   * Same as RepositoryWatcher.getAnalysis() -- returns the current
   * analysis, running it only if the tree changed. Routed through the
   * scheduler so the max_active=1 cap is actually enforced: a poll that
   * arrives mid-re-index waits for the in-flight analysis instead of
   * starting an overlapping second one.
   */
  getAnalysis(): Promise<AnalyzeRepositoryResult> {
    return new Promise((resolve, reject) => {
      this.scheduler.schedule(
        createJob({
          name: `get-analysis:${this.rootPath}`,
          run: async () => {
            try {
              resolve(await this.inner.getAnalysis());
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          },
        })
      );
    });
  }

  async close(): Promise<void> {
    this.pushQueue.close();
    await this.pushFsWatcher.close();
    await this.inner.close();
  }
}