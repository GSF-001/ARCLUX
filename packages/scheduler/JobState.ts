// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Pattern reference: Linux kernel kernel/workqueue.c + include/linux/workqueue.h
// (queue -> execute -> done lifecycle, priority, delayed work, ordered mode).
// Concurrency-management/CPU-affinity concepts (NUMA, cpumask, per-CPU pools)
// deliberately NOT ported -- not applicable to a single-process Node scheduler.

export const JobStatus = {
  PENDING: "pending",
  DELAYED: "delayed",
  RUNNING: "running",
  DONE: "done",
  FAILED: "failed",
} as const;

export type JobStatusValue = (typeof JobStatus)[keyof typeof JobStatus];

export interface JobStateEntry {
  jobId: string;
  status: JobStatusValue;
  /** epoch ms this state was entered */
  since: number;
  /** set only when status is FAILED */
  error?: string;
}

export function createJobState(jobId: string, status: JobStatusValue = JobStatus.PENDING): JobStateEntry {
  return { jobId, status, since: Date.now() };
}

export function transitionJobState(entry: JobStateEntry, status: JobStatusValue, error?: string): JobStateEntry {
  return { ...entry, status, since: Date.now(), error };
}
