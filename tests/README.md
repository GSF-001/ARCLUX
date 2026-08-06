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
