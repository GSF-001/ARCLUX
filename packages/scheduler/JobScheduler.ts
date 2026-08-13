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

  /** Pulls runnable jobs off the queue until maxActive is reached or the queue is empty. */
  private drain(): void {
    while (this.runningCount < this.maxActive) {
      const job = this.queue.dequeue();
      if (!job) break;
      this.runJob(job);
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
