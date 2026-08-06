# tests/


Automated tests, run with Vitest (https://vitest.dev).

    npx vitest run          # run once
    npx vitest               # watch mode
    npx vitest run tests/parser/go.test.ts   # one file

## What's tested here

- **`parser/`** — language/manifest parsers against real files copied
  from actual public repos (not hand-written fixtures) — e.g.
  parser/go.test.ts parses gin's real go.mod and asserts on the
  exact dependency list. The real files live in tests/fixtures/.
- **`indexer/`** — cross-file resolution logic, like same-package
  implicit dependencies for languages (Go, Java) that don't require
  explicit imports between files in one package/directory.
- **`watcher/`** — debounce/dedup behavior for the file-change queue
  that powers incremental re-indexing, using Vitest's fake timers so
  the tests run instantly instead of actually waiting.

## Adding a test for a real-world edge case

If you find a bug by running a parser or detector against a real repo
(see scripts/testManifests.ts / scripts/testPlayground.ts for ad-hoc
verification against real code), the pattern to follow is: copy the
offending file into tests/fixtures/, then write a test that pins the
exact expected output. That's how tests/fixtures/Cargo.toml.tokio
came to exist — it caught a real bug in Cargo.toml parsing
(platform-conditional dependency sections weren't handled) before it
shipped.
=======
Automated tests, run via Vitest. All 19 tests passing as of this writing
(4 test files, 0 failures) - verified by actually running `npx vitest run`,
not inferred from file presence.

Run all tests:

    npx vitest run

Run one file:

    npx vitest run tests/parser/go.test.ts

## Test files

| File | Tests | What it covers |
|---|---|---|
| parser/go.test.ts | 4 | parseGoMod against a REAL go.mod (gin's, fixtures/go.mod.gin) - 35 deps, all runtime, version extraction, empty-require-block edge case. |
| parser/rust.test.ts | 4 | parseCargoToml against a REAL Cargo.toml (tokio's, fixtures/Cargo.toml.tokio) - 36 deps (16 runtime/20 dev), platform-conditional section resolution, empty-manifest edge case. |
| indexer/resolveSameScopeDependencies.test.ts | 6 | Go's "same package, no import needed" implicit dependency resolution, against the REAL playground/go-demo fixture. |
| watcher/changeQueue.test.ts | 5 | createChangeQueue debounce behavior - flush timing, timer reset, dedup by path, close() behavior. Uses Vitest fake timers. |

## Fixtures

tests/fixtures/ holds REAL manifest files copied from public repos
(go.mod from gin-gonic/gin, Cargo.toml from tokio-rs/tokio) - not
hand-written.

## Coverage gaps

Only 4 of the working packages listed in packages/README.md have
dedicated tests. Everything else currently working has been verified via
scripts/testPlayground.ts and scripts/testManifests.ts manual runs (see
root PROGRES.md) but has no automated regression test yet.

main
