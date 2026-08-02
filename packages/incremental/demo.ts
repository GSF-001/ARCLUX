// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Standalone runnable proof that Cell/Query/Database actually behave as
// intended — not part of the production pipeline. Run with:
//   npx tsx packages/incremental/demo.ts

import { Database } from "./Database";
import { Cell } from "./Cell";
import { Query } from "./Query";

const db = new Database();
const a = new Cell(db, 2);
const b = new Cell(db, 3);

let sumRuns = 0;
const sum = new Query(db, () => {
  sumRuns++;
  return a.get() + b.get();
});

let doubledRuns = 0;
const doubled = new Query(db, () => {
  doubledRuns++;
  return sum.get() * 2;
});

console.log("--- first call ---");
console.log("doubled =", doubled.get(), `(sum ran ${sumRuns}x, doubled ran ${doubledRuns}x — expect 1x, 1x)`);

console.log("--- second call, nothing changed ---");
console.log("doubled =", doubled.get(), `(sum ran ${sumRuns}x, doubled ran ${doubledRuns}x — expect still 1x, 1x: fully cached)`);

console.log("--- a.set(10), real change ---");
a.set(10);
console.log("doubled =", doubled.get(), `(sum ran ${sumRuns}x, doubled ran ${doubledRuns}x — expect 2x, 2x: both recompute)`);

console.log("--- b.set(3), SAME value as before ---");
b.set(3);
console.log("doubled =", doubled.get(), `(sum ran ${sumRuns}x, doubled ran ${doubledRuns}x — expect still 2x, 2x: Cell.set no-ops on identical value)`);

console.log("--- cycle detection ---");
try {
  const cyclic: Query<[], number> = new Query(db, () => cyclic.get() + 1);
  cyclic.get();
  console.log("FAIL: should have thrown");
} catch (err) {
  console.log("OK, threw as expected:", (err as Error).message);
}
