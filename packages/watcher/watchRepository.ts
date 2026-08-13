// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Wires chokidar (watchFilesystem.ts) + debouncing (changeQueue.ts) into
// packages/incremental's Cell/Query/Database. This is intentionally the
// COARSE version of incremental re-analysis, not true per-file granular
// recomputation:
//
// - One Cell holds a single "revision token" (just a counter, bumped on
//   every flushed change batch) for the WHOLE watched directory, not one
//   Cell per file. A single Query wraps the entire analyzeRepository()
//   call (localPath flow) and reads that Cell.
// - Consequence: ANY change anywhere in the tree invalidates the ENTIRE
//   cached analysis, triggering a full re-run of analyzeRepository()
//   (which itself does a full buildIndex() rebuild — see buildIndex.ts,
//   it has no partial-update mode). This is NOT what "incremental" means
//   in the packages/incremental sense of per-Cell fine-grained
//   invalidation — it only gives you ONE real benefit: if the watcher
//   fires (e.g. on restart, or a save that didn't actually change file
//   contents) but nothing has changed, the cached Query result is reused
//   and analyzeRepository() does NOT re-run at all.
// - True per-file granular incrementality (only re-parsing changed files,
//   reusing cached ModuleInfo for untouched ones) would require
//   buildIndex.ts itself to be rewritten around Cell/Query internally,
//   which is a much larger change deliberately out of scope here — see
//   PROGRES.md decisions entry for why this smaller version was chosen
//   instead (avoids conflicting with a parallel pipeline.ts refactor).

import { Database } from "../incremental/Database";
import { Cell } from "../incremental/Cell";
import { Query } from "../incremental/Query";
import { watchFilesystem, type FilesystemWatcher } from "./watchFilesystem";
import { createChangeQueue, type ChangeQueue } from "./changeQueue";
import { analyzeRepository, type AnalyzeRepositoryResult } from "../engine/pipeline";

export interface RepositoryWatcher {
  /** Returns the current analysis, running it only if the tree has
   * changed since the last call (or this is the first call). */
  getAnalysis(): Promise<AnalyzeRepositoryResult>;
  close(): Promise<void>;
}

/**
 * Starts watching rootPath. Call getAnalysis() whenever a consumer (CLI
 * command, future UI) wants the current analysis — it will be instant
 * (cached) if nothing has changed, or trigger a fresh full re-run
 * otherwise. This does NOT push updates proactively; there's no event
 * emitter for "analysis changed" here, by design — see PROGRES.md
 * decisions entry. Callers that want live updates must poll getAnalysis().
 */
export function watchRepository(rootPath: string): RepositoryWatcher {
  const db = new Database();
  const revisionToken = new Cell(db, 0);

  // The compute function is async, but Query.compute's type is a plain
  // (...args) => T. Query does not natively support caching a Promise's
  // RESOLVED value across recomputation checks — it would cache the
  // Promise object itself, which is fine for this use case (awaiting an
  // already-resolved Promise repeatedly is cheap and correct), but is
  // worth flagging: this is relying on Promise identity being stable
  // across cache hits, not on Query having any real async-awareness.
  const analysisQuery = new Query(db, () => {
    revisionToken.get(); // register as a dependency, ignore the value itself
    return analyzeRepository({ localPath: rootPath });
  });

  const queue: ChangeQueue = createChangeQueue(() => {
    revisionToken.set(revisionToken.peek() + 1);
  });

  const fsWatcher: FilesystemWatcher = watchFilesystem(rootPath, (event) => {
    queue.push(event);
  });

  return {
    getAnalysis(): Promise<AnalyzeRepositoryResult> {
      return analysisQuery.get();
    },
    async close(): Promise<void> {
      queue.close();
      await fsWatcher.close();
    },
  };
}
