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

import { EventEmitter } from "node:events";
import { watchRepository, type RepositoryWatcher } from "../watcher/watchRepository";
import { watchFilesystem, type FilesystemWatcher } from "../watcher/watchFilesystem";
import { createChangeQueue, type ChangeQueue } from "../watcher/changeQueue";
import type { AnalyzeRepositoryResult } from "../engine/pipeline";

export interface DaemonRepositoryEvents {
  "analysis:updated": [AnalyzeRepositoryResult];
  "analysis:error": [Error];
}

/**
 * Wraps watchRepository() + its own separate filesystem watcher/queue to
 * push "analysis:updated" whenever a change batch flushes, instead of
 * requiring the caller to poll getAnalysis(). Runs a SECOND watcher on the
 * same rootPath rather than modifying watchRepository.ts itself, keeping
 * that module's pull-only contract intact for existing callers (e.g. the
 * `work` command) while this one adds push on top.
 */
export class DaemonRepositoryWatcher extends EventEmitter {
  private readonly inner: RepositoryWatcher;
  private readonly pushFsWatcher: FilesystemWatcher;
  private readonly pushQueue: ChangeQueue;

  constructor(private readonly rootPath: string) {
    super();
    this.inner = watchRepository(rootPath);

    this.pushQueue = createChangeQueue(() => {
      this.inner
        .getAnalysis()
        .then((result) => this.emit("analysis:updated", result))
        .catch((err) => this.emit("analysis:error", err instanceof Error ? err : new Error(String(err))));
    });

    this.pushFsWatcher = watchFilesystem(rootPath, (event) => {
      this.pushQueue.push(event);
    });
  }

  /** Same as RepositoryWatcher.getAnalysis() -- for a caller that wants an immediate read without waiting for the next push event. */
  getAnalysis(): Promise<AnalyzeRepositoryResult> {
    return this.inner.getAnalysis();
  }

  async close(): Promise<void> {
    this.pushQueue.close();
    await this.pushFsWatcher.close();
    await this.inner.close();
  }
}
