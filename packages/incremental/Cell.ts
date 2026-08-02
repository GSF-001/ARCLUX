// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Database } from "./Database";

/**
 * A mutable input to the incremental computation graph — analogous to
 * salsa's #[salsa::input]. Anything read via .get() while inside a
 * Query's computation is automatically tracked as a dependency; calling
 * .set() bumps the database's revision, which is how downstream Queries
 * know they might need to recompute.
 */
export class Cell<T> {
  private value: T;
  private revision: number;

  constructor(private readonly db: Database, initial: T) {
    this.value = initial;
    this.revision = db.currentRevision();
  }

  get(): T {
    this.db.recordRead({ kind: "cell", cell: this as Cell<unknown> }, this.revision);
    return this.value;
  }

  /**
   * Updates the value. No-ops (does not bump revision) if the new value is
   * reference-identical to the current one via Object.is — setting a Cell
   * to "the same thing" shouldn't trigger downstream recomputation.
   */
  set(value: T): void {
    if (Object.is(value, this.value)) return;
    this.value = value;
    this.revision = this.db.bumpRevision();
  }

  getRevision(): number {
    return this.revision;
  }

  /** Reads the current value without registering a dependency. Use only
   * for logging/debugging — using this inside a Query's compute function
   * defeats the whole point of tracking. */
  peek(): T {
    return this.value;
  }
}
