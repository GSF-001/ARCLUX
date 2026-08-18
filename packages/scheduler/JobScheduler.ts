// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Pattern reference: Linux kernel include/linux/workqueue.h's max_active
// (cap on in-flight work items) -- jobs beyond the cap wait in JobQueue
// instead of all firing at once. CPU-affinity/NUMA pool concepts from the
// same file deliberately NOT ported -- not applicable here.

import type { Job } from "./Job";
import { JobQueue } from "./JobQueue";
import { JobStatus, createJobState, transitionJobState, type JobStateEntry } from "./JobState";

export interface JobSchedulerOptions {
  /** max jobs running concurrently, mirrors workqueue's max_active */
  maxActive?: number;
  ordered?: boolean;
}

export class JobScheduler {
  private queue: JobQueue;
  private readonly maxActive: number;
  private states = new Map<string, JobStateEntry>();
  private runningCount = 0;
  private drainTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: JobSchedulerOptions = {}) {
    this.queue = new JobQueue({ ordered: options.ordered });
    this.maxActive = options.maxActive ?? 4;
  }

  schedule(job: Job): void {
    this.queue.enqueue(job);
    this.states.set(job.id, createJobState(job.id, job.notBefore ? JobStatus.DELAYED : JobStatus.PENDING));
    this.drain();
  }

  getState(jobId: string): JobStateEntry | undefined {
    return this.states.get(jobId);
  }

  /** All known job states, for aggregation (e.g. SystemState). */
  list(): JobStateEntry[] {
    return [...this.states.values()];
  }

  /**
   * Pulls runnable jobs off the queue until maxActive is reached or the
   * queue is empty. Mirrors workqueue's worker pool waking: schedule() and
   * job completion both call this, and — the piece that was missing — if
   * only DELAYED jobs remain (notBefore in the future), a timer is armed
   * for the earliest notBefore so drain() runs again the moment that job
   * becomes runnable. Without it, a delayed job queued while no slot was
   * free would sit in the queue forever: nothing ever re-triggers drain()
   * once its delay expires (delayed_work in workqueue.h has the same
   * "wake at expiry" contract, via the timer wheel instead of setTimeout).
   */
  private drain(): void {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
      this.drainTimer = undefined;
    }

    while (this.runningCount < this.maxActive) {
      const job = this.queue.dequeue();
      if (!job) break;
      this.runJob(job);
    }

    const now = Date.now();
    const nextWake = this.queue
      .peekAll()
      .map((j) => j.notBefore ?? 0)
      .filter((t) => t > now)
      .sort((a, b) => a - b)[0];
    if (nextWake !== undefined) {
      this.drainTimer = setTimeout(() => this.drain(), nextWake - now);
    }
  }

  private async runJob(job: Job): Promise<void> {
    this.runningCount += 1;
    this.states.set(job.id, transitionJobState(this.states.get(job.id)!, JobStatus.RUNNING));

    try {
      await job.run();
      this.states.set(job.id, transitionJobState(this.states.get(job.id)!, JobStatus.DONE));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.states.set(job.id, transitionJobState(this.states.get(job.id)!, JobStatus.FAILED, message));
    } finally {
      this.runningCount -= 1;
      this.drain();
    }
  }
}
