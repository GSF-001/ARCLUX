# tests/

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
| `parser/go.test.ts` | 4 | `parseGoMod` against a REAL go.mod (gin's, fixtures/go.mod.gin) - 35 deps, all runtime, version extraction, empty-require-block edge case. Makes the manual scripts/testManifests.ts verification (see root PROGRES.md) permanent instead of eyeballed. |
| `parser/rust.test.ts` | 4 | `parseCargoToml` against a REAL Cargo.toml (tokio's, fixtures/Cargo.toml.tokio) - 36 deps (16 runtime/20 dev), platform-conditional section resolution (windows-sys appearing in both a runtime and dev cfg(windows) section), empty-manifest edge case. Directly guards against regressing the 13->36 dep bug fix documented in root PROGRES.md. |
| `indexer/resolveSameScopeDependencies.test.ts` | 6 | Go's "same package, no import needed" implicit dependency resolution, against the REAL playground/go-demo fixture (not a copy). Confirms main.go correctly resolves as depending on models.go + service.go, whole-word matching doesn't create false self-dependencies, files with no real callers resolve to no deps. |
| `watcher/changeQueue.test.ts` | 5 | `createChangeQueue` debounce behavior - doesn't flush early, flushes once after the debounce window, resets timer on new events, dedupes by path keeping the latest event kind, stops flushing after `close()`. Uses Vitest fake timers, no real waiting. |

## Fixtures

`tests/fixtures/` holds REAL manifest files copied from public repos
(go.mod from gin-gonic/gin, Cargo.toml from tokio-rs/tokio) - not
hand-written. These are the same files originally verified manually via
`scripts/testManifests.ts` against `~/manifest-samples` (outside the repo)
before being committed here as permanent fixtures. See root PROGRES.md
for the original manual verification run.

## IMPORTANT: this resolves a previously-documented limitation

`packages/indexer/resolveSameScopeDependencies.ts` is now wired into
`buildIndex.ts` (confirmed via grep, not assumed). This means the "Go/Java
show 0 graph edges because same-package files don't need import
statements" limitation documented in `playground/README.md` and root
PROGRES.md for `parseGo.ts`/`parseJava.ts` **no longer applies** as
written - it's been fixed since those docs were written. Those docs need
a follow-up correction; not done as part of this file.

## Coverage gaps

Only 4 of the working packages listed in `packages/README.md` have
dedicated tests (parser's Go/Rust manifest side, indexer's same-scope
resolver, watcher's changeQueue). Everything else currently working
(detectors, impact, incremental, repository, most of parser/graph/shared)
has been verified via `scripts/testPlayground.ts` and
`scripts/testManifests.ts` manual runs (see root PROGRES.md) but has no
automated regression test yet.
