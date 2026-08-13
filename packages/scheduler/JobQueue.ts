// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Pattern reference: Linux kernel include/linux/workqueue.h's WQ_HIGHPRI
// (high-priority work jumps the queue) and the "ordered" workqueue_attrs
// flag (work items must execute strictly in queueing order).

import type { Job } from "./Job";
import { isJobRunnable } from "./Job";

export interface JobQueueOptions {
  /** if true, dequeue() always returns jobs in insertion order, ignoring priority */
  ordered?: boolean;
}

export class JobQueue {
  private jobs: Job[] = [];
  private readonly ordered: boolean;

  constructor(options: JobQueueOptions = {}) {
    this.ordered = options.ordered ?? false;
  }

  enqueue(job: Job): void {
    this.jobs.push(job);
  }

  /**
   * Returns and removes the next runnable job. High-priority jobs jump
   * ahead of normal-priority ones (mirrors WQ_HIGHPRI), unless this queue
   * is in ordered mode, in which case strict insertion order applies
   * regardless of priority (mirrors the "ordered" workqueue_attrs flag).
   * Jobs with a future notBefore are skipped until runnable.
   */
  dequeue(now: number = Date.now()): Job | null {
    const runnableIndices = this.jobs
      .map((job, i) => ({ job, i }))
      .filter(({ job }) => isJobRunnable(job, now));

    if (runnableIndices.length === 0) return null;

    let chosen = runnableIndices[0];
    if (!this.ordered) {
      const highPriority = runnableIndices.find(({ job }) => job.priority === "high");
      if (highPriority) chosen = highPriority;
    }

    this.jobs.splice(chosen.i, 1);
    return chosen.job;
  }

  peekAll(): Job[] {
    return [...this.jobs];
  }

  get size(): number {
    return this.jobs.length;
  }
}
