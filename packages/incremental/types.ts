// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * A reference to something a Query read during computation — either a raw
 * Cell or another Query's cached result at a specific key. Recorded by
 * Database.recordRead() and later used to check whether a cached result
 * is still valid (see Query.isStillValid).
 *
 * The cell/query fields use minimal structural types (not the classes
 * themselves) so this module stays an import-free leaf — importing Cell
 * and Query here created module cycles Cell↔Database↔types↔Cell and
 * Database↔types↔Query↔Database (flagged by detectCircularDependency).
 * The shapes match exactly what Query.isStillValid() calls on them.
 */
export type DepRef =
  | { kind: "cell"; cell: { getRevision(): number } }
  | {
      kind: "query";
      query: { ensureUpToDateAndGetRevision(key: string, args: unknown[]): number };
      key: string;
      args: unknown[];
    };
