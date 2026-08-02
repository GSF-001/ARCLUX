// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Conceptually inspired by salsa-rs/salsa (dual MIT/Apache-2.0) — the
// input/query/revision model and "early cutoff" idea come from there. This
// is NOT a port: salsa relies on Rust proc-macros for zero-cost dependency
// tracking; this is a from-scratch, more naive re-implementation of the
// same principle in plain TypeScript, using a runtime stack instead of
// compile-time codegen. See salsa's README + examples/lazy-input for the
// original design this draws from.

import type { DepRef } from "./types";

interface ReadFrame {
  deps: DepRef[];
  maxRevision: number;
}

/**
 * Coordinates revisions and dependency tracking across all Cells and
 * Queries. One Database per independent incremental computation graph —
 * ARCLUX would have exactly one, shared across the whole analysis pipeline,
 * once this is wired in (not yet done — see PROGRES.md).
 */
export class Database {
  private revision = 0;
  private readStack: ReadFrame[] = [];

  currentRevision(): number {
    return this.revision;
  }

  /** Called by Cell.set() whenever a value actually changes. */
  bumpRevision(): number {
    this.revision += 1;
    return this.revision;
  }

  /**
   * Called by Cell.get() / Query.get() whenever they're read. If a
   * computation is currently being tracked (i.e. we're inside a
   * trackDependencies() call), this records the read against that frame.
   * Reads that happen outside any tracked computation (e.g. a top-level
   * `cell.get()` from user code) are silently ignored — there's nothing to
   * attribute the dependency to.
   */
  recordRead(dep: DepRef, atRevision: number): void {
    if (this.readStack.length === 0) return;
    const frame = this.readStack[this.readStack.length - 1];
    frame.deps.push(dep);
    if (atRevision > frame.maxRevision) frame.maxRevision = atRevision;
  }

  /**
   * Runs `fn`, capturing every Cell/Query it reads (directly or via nested
   * tracked calls) and the highest revision among them. If this is called
   * while another trackDependencies() is already active (nested queries),
   * captured deps also bubble up to the enclosing frame — a query that
   * calls another query transitively depends on everything the inner one
   * read too.
   */
  trackDependencies<T>(fn: () => T): { result: T; dependencies: DepRef[]; maxDepRevision: number } {
    this.readStack.push({ deps: [], maxRevision: 0 });
    let result: T;
    try {
      result = fn();
    } finally {
      // eslint-disable-next-line no-var
      var frame = this.readStack.pop()!;
    }

    if (this.readStack.length > 0) {
      const parent = this.readStack[this.readStack.length - 1];
      parent.deps.push(...frame.deps);
      if (frame.maxRevision > parent.maxRevision) parent.maxRevision = frame.maxRevision;
    }

    return { result: result!, dependencies: frame.deps, maxDepRevision: frame.maxRevision };
  }
}
