// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Pattern reference: Linux kernel include/linux/workqueue.h's struct
// delayed_work (deferred execution via a target time) and WQ_HIGHPRI
// (priority jumps the queue instead of strict FIFO).

export type JobPriority = "high" | "normal";

export interface Job {
  id: string;
  name: string;
  priority: JobPriority;
  /** the work itself */
  run: () => Promise<void>;
  /**
   * epoch ms this job should not run before. Undefined means "runnable
   * immediately" -- mirrors workqueue.h's plain work_struct vs delayed_work
   * distinction, but as one type with an optional field rather than two.
   */
  notBefore?: number;
}

export interface CreateJobOptions {
  name: string;
  run: () => Promise<void>;
  priority?: JobPriority;
  /** delay in ms before this job becomes runnable */
  delayMs?: number;
}

let jobCounter = 0;

export function createJob(options: CreateJobOptions): Job {
  jobCounter += 1;
  return {
    id: `job-${Date.now()}-${jobCounter}`,
    name: options.name,
    priority: options.priority ?? "normal",
    run: options.run,
    notBefore: options.delayMs ? Date.now() + options.delayMs : undefined,
  };
}

export function isJobRunnable(job: Job, now: number = Date.now()): boolean {
  return job.notBefore === undefined || job.notBefore <= now;
}
