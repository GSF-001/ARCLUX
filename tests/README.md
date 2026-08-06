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
