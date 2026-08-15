# ARCLUX Progress — Backlog (still empty)

See PROGRES.md for the index. Split by topic from the original PROGRES-status.md.

## 2026-08-13 — UPDATE: framework rule stubs — implemented

All 10 remaining rule stubs in `packages/rules/*` (nextjs x4, nestjs x2,
express, vite, electron x2) are now implemented, wired into
`apps/cli/verify.ts` and `packages/engine/contract.ts` (13 rules total,
react/requirePropsTyping remains a documented deferral; **14 rules as of
2026-08-14 with laravel/requireController — issue #53**). Test coverage
for issue #8 completed: graph, impact, indexer, pipeline, and per-language
parser suites — 141 tests / 20 files, vitest green. See the old entry
below for the historical stub list.

## 2026-08-15 — Test coverage expanded (detector, pipeline, impact)

**Status:** Done

Added `tests/detector.test.ts` (19 detector smoke tests, one per detector
covering basic signature/return type), `tests/pipeline.test.ts` (6 tests:
error handling for invalid options, AnalyzeRepositoryResult structure
validation, scanSummary shape check), `tests/impact.test.ts` (5 tests:
calculateAffectedFiles/buildImpactTree/traceConsumers/traceDependencies).
Tests are non-dogmatic placeholder level (no fixtures, signature-only —
detectors already have guard-inventory.test.ts with real fixtures) but
establish that all 19 detectors return arrays without crashing on an empty
repo. Verified: `npx vitest tests/{detector,pipeline,impact}.test.ts` green.

## 2026-08-15 — CLI commands stubbed out (open, verify, logs, edit)

**Status:** Done

Added 4 command files to `apps/cli/commands/`: 
- `open.ts` — open analysis results in browser or editor (not yet implemented,
  honest placeholder with --browser/--editor flags)
- `verify.ts` — run all framework rules + detectors via runDoctor, output
  grouped by check, JSON support. Real implementation calling
  analyzeRepository + runDoctor
- `logs.ts` — view daemon or CLI logs from ~/.arclux/logs/
- `edit.ts` — read current + replacement file, show diff preview, apply with
  --apply flag

open.ts and logs.ts are placeholders (print what they would do). verify.ts and
edit.ts are real implementations. None wired into apps/cli/index.ts CLI router
yet — that's a follow-up (consistent with "add files, update PROGRES.md, don't
create orphans" rule).

## 2026-08-03 — ❌ STILL EMPTY (8-line stub, license header only)

**Priority #1 — core feature — NOTE: this was previously miscategorized,
see "packages/impact/* already done" update below**

**High priority**:
- `packages/db/*` (5 files)
- `components/workspace/*` (5 files + 3 panels — all stubs)
- `components/explorer/Explorer.tsx`, `DependencyList.tsx`, `ImpactSummary.tsx`
- `components/overview/RepositoryHeader/Info/Overview.tsx`
- `components/search/GlobalSearch.tsx` (just needs to use the existing
  `fuzzyScore.ts`)
- Remaining detectors (8 of 18 — see list above)

**Medium priority**:
- `packages/cache/*`, `packages/watcher/*` (5 & 4 files respectively)
- `packages/git/*` (`checkoutBranch`, `detectDefaultBranch`,
  `getBranches`, `getCommitHistory`, `getContributors` — different from
  `cloneRepository`/`cleanupRepository`/`readGitignore`, which are already
  done)

> **[STATUS UPDATE, 2026-08-14]: resolved — all 5 are implemented.
> getBranches + detectDefaultBranch (git ls-remote, no clone) power GET
> /api/branches and the workspace branch switcher (see status-web.md);
> checkoutBranch/getCommitHistory/getContributors operate on a local
> clone (see status-core.md "packages/git history helpers").**
- `packages/graph/buildCallGraph/buildExportGraph/buildImportGraph.ts`
- Remaining `packages/indexer/*` (`indexSchema`, `resolveComponents/Exports/
  Hooks/Providers/Routes`, `updateIndex`, `watchIndex`) — **the empty
  `resolveRoutes.ts` is why `detectUnusedExports` is not yet
  entry-file-aware**
- Remaining `packages/rules/*` (electron, express, nestjs, react, vite — 9
  files, `nextjs/*` also still 3 of 4 stubs: `requireIndexUpdate`,
  `requireLayoutUpdate`, `requireMetadata`)
- `packages/search/*` (SearchEngine, SearchFilters, SearchIndex,
  SearchKeyboard, SearchProvider, SearchResults — different from the
  already-done `fuzzyScore.ts`, which isn't yet plugged into these)
- `packages/ui/*` (5 files) — ⚠️ **watch for duplication**: `graphColor.ts`
  here vs `theme/graphColors.ts` in `apps/web`, which is already done —
  very similar names, same dead-code risk as a previous incident if
  someone writes content here without realizing a working version already
  exists
- `apps/web/features/*` (13 files — graph, impact, issues, repository,
  search stores/hooks, all stubs)
- Remaining `apps/web/hooks/*` (useClipboard, useCommandPalette,
  useDebounce, useMediaQuery)
- `apps/web/lib/api.ts`, `lib/graph.ts`
- `apps/web/theme/motion.ts`, `spacing.ts`, `typography.ts`
- Other-language parsers: cpp, csharp, go, java, javascript
  (parseCommonJs/Js/Jsx), php, ruby, rust — all 0%. `parser/config/*`
  (json, packageJson, toml, yaml) also 0%. `parser/core/parseImports.ts`
  0%.
- `parser/typescript/parseTsx.ts`, `parseTsConfig.ts` — check first whether
  these really need separate implementation or the logic already lives in
  `parseTs.ts` (194 lines) before rewriting

**Low priority**:
- `scripts/*` (4 files: benchmark, build, generateFixtures, release)
- `tests/*` (everything — detector, graph, impact, indexer, pipeline,
  per-language parser tests) — 0% total, there isn't a single test in
  this project yet

---


## 2026-08-11 — Explorer.tsx exists but never mounted, likely contributes to weak first impression

> **[STATUS UPDATE, 2026-08-14]: RESOLVED — Explorer is now mounted as a
> right-hand panel on the graph page, opening when a file node is
> selected (see progres/status-web.md "Explorer panel mounted into the
> graph page").**

**Status:** Done

Confirmed via grep: zero references to Explorer in apps/web/app. Component exists, works standalone, but no page renders it. Worth prioritizing -- a working workspace/explorer view is probably wha[...]

## 2026-08-14 — UPDATE: the 2026-08-03 "STILL EMPTY" list — mostly resolved

> **[STATUS UPDATE, 2026-08-14]: the 2026-08-03 "❌ STILL EMPTY" list
> below is largely historical now.** Resolved since then (see the
> individual status files): `packages/search/*` (issue #9, 6/6),
> `graph/buildCallGraph.ts` (issue #50), `indexer/resolveRoutes.ts`
> (issue #7), remaining hooks (issue #147, 3/3), all framework rule
> stubs (13→14 rules incl. laravel), tests (141→191). Still open: the
> resolver family isn't attached to ModuleInfo by buildIndex, and
> `Explorer`/`workspace`/`overview` panels still aren't mounted on any
> page.

## 2026-08-14 — Laravel framework rules (issue #53)

**Status:** Done

`packages/parser/php/parsePhpRoutes.ts` (new) extracts controller
references from `routes/web.php`/`routes/api.php` — v1 handles only the
array callable syntax `[UserController::class, 'index']`; closures and
string callables (`'UserController@index'`) are documented as skipped.
`packages/rules/laravel/requireController.ts` (new) flags routes
referencing controllers with no file under `app/Http/Controllers/`.
Registered in both `apps/cli/verify.ts` and `packages/engine/contract.ts`;
framework detection extended to read composer.json (`laravel/framework`
→ `laravel`). Verified against real routes: monica (143 controllers
extracted, closures correctly skipped; DDD layouts give false
"missing" — documented v1 limitation) and laravel/laravel 11.x
(closure-only → 0 refs, correct). 8 tests (tests/rules-laravel.test.ts).

## 2026-08-15 — Remaining stub files as of this session

**Status:** Not Started

Confirmed via line-count scan (find packages -name '*.ts' | wc -l <= 9): packages/parser/{csharp,ruby,rust,cpp}/* (source parsers, manifest parsing already exists per earlier decisions), packages[...]
