# tests/

Automated tests, run with Vitest (https://vitest.dev).

    npx vitest run          # run once
    npx vitest               # watch mode
    npx vitest run tests/parser/go.test.ts   # one file

## What's tested here

- **`parser/`** — language/manifest parsers. Manifest tests run against
  real files copied from actual public repos (gin's go.mod, tokio's
  Cargo.toml — see tests/fixtures/). Language-parser tests parse inline
  source strings: typescript, javascript (ESM/JSX/CommonJS), python
  (tree-sitter), java, golang.
- **`indexer/`** — cross-file resolution logic (same-package implicit
  dependencies for Go/Java) and a full `buildIndex` pass over a real
  temp directory (scan → parse → resolve → importedBy back-fill).
- **`watcher/`** — debounce/dedup behavior for the file-change queue
  that powers incremental re-indexing, using Vitest's fake timers.
- **Root-level suites** — detectors (unit + the 8 doctor-wired
  detectors + scanFiles cycle guard), the rule engine (all 14
  implemented rules, incl. laravel/requireController from issue #53),
  impact analysis (`calculateAffectedFiles`), the call graph
  (issue #50), the search engine (issue #9), the dependency graph
  builder, the analyze summary, and the pipeline entry point
  (`analyzeRepository({ localPath })` end-to-end against a temp repo
  with package.json framework detection).

## Status

224 tests across 26 files, all passing (`npx vitest run`).

## Test files

| File | Tests | What it covers |
|---|---|---|
| detector.test.ts | 4 | detectAmbiguousSymbolResolution core cases |
| detectors-wired.test.ts | 17 | the 8 detectors wired into doctor.ts |
| core-detectors.test.ts | 14 | core detector helpers/behaviors (incl. entry-point filtering, issues #4/#7) |
| scanFiles-cycle.test.ts | 1 | junction/symlink cycle guard in scanFiles |
| rules.test.ts | 10 | RuleEngine + requirePage + 2 react rules |
| rules-frameworks.test.ts | 37 | the 10 framework rules (nextjs x4, nestjs x2, express, vite, electron x2) |
| rules-laravel.test.ts | 8 | laravel/requireController (issue #53): controller existence, v1 scope |
| graph.test.ts | 6 | buildDependencyGraph: dedup, external drops, implicit edges |
| graph-callgraph.test.ts | 17 | buildCallGraph + extractCallsJs/TS (issues #50/#316): bare calls, weight, calledBy |
| runDoctor.test.ts | 7 | packages/engine/runDoctor (POST /api/doctor): 19 detectors normalized + safeRun crash isolation |
| git-history.test.ts | 6 | packages/git checkoutBranch/getCommitHistory/getContributors against a real temp git repo |
| guard-inventory.test.ts | 14 | negative controls for the 7 detectors that had none (deadCode, duplicateModules, entryPoints, indexFiles, largeModules, layerViolation, sharedModules) |
| impact.test.ts | 5 | calculateAffectedFiles: transitive, diamond, notFound |
| indexer.test.ts | 6 | buildIndex end-to-end on a real temp dir (incl. scanSummary eligible_seen accounting) |
| pipeline.test.ts | 3 | analyzeRepository localPath: frameworks, index, graph, manifest deps |
| analyze-summary.test.ts | 2 | CLI analyze summary formatting |
| search.test.ts | 19 | packages/search engine (issue #9): index build, ranking, filters, session |
| parser/typescript.test.ts | 10 | parseTs import/export kinds + bare-call extraction (issue #316) |
| parser/javascript.test.ts | 6 | parseJs / parseJsx / parseCommonJs |
| parser/python.test.ts | 5 | parsePython (tree-sitter) imports/exports |
| parser/java.test.ts | 4 | parseJava imports, public-only exports, scopeId |
| parser/golang.test.ts | 4 | parseGo imports, uppercase exports, scopeId |
| parser/go.test.ts | 4 | parseGoMod against gin's real go.mod |
| parser/rust.test.ts | 4 | parseCargoToml against tokio's real Cargo.toml |
| indexer/resolveSameScopeDependencies.test.ts | 6 | Go same-package implicit dependency resolution |
| watcher/changeQueue.test.ts | 5 | change queue debounce/dedup (fake timers) |

## Guard inventory — detector coverage matrix

Every detector has at least one committed negative control (a KNOWN-BAD
fixture that must fire). This is the "detector definitely fires"
guarantee — see tests/guard-inventory.test.ts for the 7 detectors that
previously had only manual verifications.

| Detector | Covered in |
|---|---|
| detectCircularDependency, detectUnusedExports, detectOrphanFiles | core-detectors.test.ts |
| detectAmbiguousSymbolResolution | detector.test.ts |
| detectComponentConvention, detectFeatureStructure, detectMissingExports, detectRepositoryPattern, detectRouteConvention, detectStoryConvention, detectTestConvention, detectUnusedFiles | detectors-wired.test.ts |
| detectDeadCode, detectDuplicateModules, detectEntryPoints, detectIndexFiles, detectLargeModules, detectLayerViolation, detectSharedModules | guard-inventory.test.ts |
| runDoctor normalization (all 19 via runDoctor) | runDoctor.test.ts |

## Fixtures

tests/fixtures/ holds REAL manifest files copied from public repos
(go.mod from gin-gonic/gin, Cargo.toml from tokio-rs/tokio) — not
hand-written. See tests/fixtures/README if one exists.

## Adding a test for a real-world edge case

If you find a bug by running a parser or detector against a real repo
(see scripts/testManifests.ts / scripts/testPlayground.ts for ad-hoc
verification against real code), the pattern to follow is: copy the
offending file into tests/fixtures/, then write a test that pins the
exact expected output. That's how tests/fixtures/Cargo.toml.tokio
came to exist — it caught a real bug in Cargo.toml parsing
(platform-conditional dependency sections weren't handled) before it
shipped.
