// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Cell } from "./Cell";
import type { Query } from "./Query";

/**
 * A reference to something a Query read during computation — either a raw
 * Cell or another Query's cached result at a specific key. Recorded by
 * Database.recordRead() and later used to check whether a cached result
 * is still valid (see Query.isStillValid).
 */
export type DepRef =
  | { kind: "cell"; cell: Cell<unknown> }
  | { kind: "query"; query: Query<unknown[], unknown>; key: string; args: unknown[] };
