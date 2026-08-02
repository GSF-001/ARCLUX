// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Database } from "./Database";
import type { DepRef } from "./types";

interface CacheEntry<T> {
  value: T;
  /** Highest revision among this entry's dependencies at computation time
   * — OR the previous entry's computedRevision, if early cutoff applied
   * (see the comment in get()). */
  computedRevision: number;
  /** db.currentRevision() the last time we confirmed this entry is still
   * valid — lets isStillValid short-circuit if nothing has changed at all
   * since the last check, without re-walking dependencies. */
  verifiedAtRevision: number;
  dependencies: DepRef[];
}

/**
 * A memoized, incrementally-recomputed function — analogous to a salsa
 * "tracked function". Results are cached per argument tuple (via keyFn).
 * On repeat calls, a cached result is reused unless a dependency (a Cell
 * or another Query result read during the original computation) has a
 * newer revision than the one recorded at computation time — in which
 * case the dependency chain is re-validated (recursively) and recomputed
 * only where actually necessary.
 *
 * Known limitations (real, not placeholders):
 * - Early cutoff (see get()) uses Object.is, so it only short-circuits for
 *   primitives or literal reference equality — returning a new object with
 *   identical contents still counts as "changed" and won't cut off
 *   downstream recomputation. Deep-equality cutoff would need a
 *   caller-supplied comparator; not implemented here.
 * - Dependency tracking during cache-hit validation is over-approximate:
 *   if validating query A's cached entry requires recomputing dependency
 *   query B, and this whole thing happens inside a *third* query C's
 *   tracked computation, C ends up depending on both A and B directly
 *   (not just A, with B implied transitively through A). This is safe
 *   (no missed invalidations) but not maximally minimal.
 * - Cycle detection throws rather than resolving — there is no fixed-point
 *   iteration like some incremental systems support for genuinely
 *   recursive queries. A query (transitively) depending on itself with the
 *   same key is a bug in the caller, not a supported pattern here.
 */
export class Query<Args extends unknown[], T> {
  private cache = new Map<string, CacheEntry<T>>();
  private computing = new Set<string>();

  constructor(
    private readonly db: Database,
    private readonly compute: (...args: Args) => T,
    private readonly keyFn: (...args: Args) => string = (...args) => JSON.stringify(args)
  ) {}

  get(...args: Args): T {
    const key = this.keyFn(...args);

    if (this.computing.has(key)) {
      throw new Error(
        `Cyclic query: re-entered with key "${key}" while already computing it. ` +
          `A query must not depend on itself, directly or transitively.`
      );
    }

    const existing = this.cache.get(key);
    if (existing && this.isStillValid(existing)) {
      this.recordSelfRead(key, args, existing.computedRevision);
      return existing.value;
    }

    this.computing.add(key);
    let result: T;
    let dependencies: DepRef[];
    let maxDepRevision: number;
    try {
      ({ result, dependencies, maxDepRevision } = this.db.trackDependencies(() => this.compute(...args)));
    } finally {
      this.computing.delete(key);
    }

    // Early cutoff: if the recomputed value is reference-identical to the
    // previous cached value, keep the OLD computedRevision instead of
    // bumping to maxDepRevision. This means a query that only depends on
    // THIS query's *value* (not on it having recomputed) won't itself be
    // forced to recompute just because an upstream input churned without
    // actually changing this result. Mirrors salsa's "backdating".
    const computedRevision =
      existing !== undefined && Object.is(existing.value, result) ? existing.computedRevision : maxDepRevision;

    this.cache.set(key, {
      value: result,
      computedRevision,
      verifiedAtRevision: this.db.currentRevision(),
      dependencies,
    });

    this.recordSelfRead(key, args, computedRevision);
    return result;
  }

  /** Used by Query.isStillValid on OTHER queries when re-validating a
   * dependency on this query. Recurses through this.get(), so it inherits
   * full validity-checking / recomputation / early-cutoff behavior — this
   * is not a raw cache peek. */
  ensureUpToDateAndGetRevision(key: string, args: unknown[]): number {
    this.get(...(args as Args));
    return this.cache.get(key)!.computedRevision;
  }

  /** Drops all cached results. Coarse-grained escape hatch for cases not
   * worth precise dependency tracking for (e.g. full repository re-scan). */
  invalidateAll(): void {
    this.cache.clear();
  }

  private recordSelfRead(key: string, args: Args, revision: number): void {
    this.db.recordRead({ kind: "query", query: this as unknown as Query<unknown[], unknown>, key, args }, revision);
  }

  private isStillValid(entry: CacheEntry<T>): boolean {
    if (entry.verifiedAtRevision === this.db.currentRevision()) return true;

    for (const dep of entry.dependencies) {
      const depRevision =
        dep.kind === "cell" ? dep.cell.getRevision() : dep.query.ensureUpToDateAndGetRevision(dep.key, dep.args);
      if (depRevision > entry.computedRevision) return false;
    }

    entry.verifiedAtRevision = this.db.currentRevision();
    return true;
  }
}
