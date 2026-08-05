// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Debounces a burst of file change events into a single flush. Editors and
// build tools routinely fire several raw filesystem events for what a
// human would call "one save" (e.g. a temp-file-then-rename pattern), so
// without debouncing, watchRepository.ts would trigger a rebuild multiple
// times per actual edit.

import type { FileChangeEvent } from "./watchFilesystem";

export interface ChangeQueueOptions {
  /** Milliseconds to wait after the LAST event before flushing. Resets on
   * every new event, so a continuous stream of edits keeps delaying flush
   * until things go quiet. */
  debounceMs?: number;
}

export interface ChangeQueue {
  push(event: FileChangeEvent): void;
  close(): void;
}

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Collects FileChangeEvents and calls onFlush with the deduped set once
 * no new events have arrived for debounceMs. Deduping is by absolutePath
 * only — if a file was both "change"d and then "unlink"ed within the same
 * debounce window, only the LAST event kind for that path survives. This
 * matches what actually matters to the caller (the file's current state),
 * not its full history within the window.
 */
export function createChangeQueue(onFlush: (events: FileChangeEvent[]) => void, options: ChangeQueueOptions = {}): ChangeQueue {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const pending = new Map<string, FileChangeEvent>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush(): void {
    timer = undefined;
    if (pending.size === 0) return;
    const events = Array.from(pending.values());
    pending.clear();
    onFlush(events);
  }

  return {
    push(event: FileChangeEvent): void {
      pending.set(event.absolutePath, event);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    },
    close(): void {
      if (timer) clearTimeout(timer);
      pending.clear();
    },
  };
}
