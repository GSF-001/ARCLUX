# ARCLUX Progress — Backlog (still empty)

See PROGRES.md for the index. Split by topic from the original PROGRES-status.md.

## 2026-08-13 — UPDATE: framework rule stubs — implemented

All 10 remaining rule stubs in `packages/rules/*` (nextjs x4, nestjs x2,
express, vite, electron x2) are now implemented, wired into
`apps/cli/verify.ts` and `packages/engine/contract.ts` (13 rules total,
react/requirePropsTyping remains a documented deferral). Test coverage
for issue #8 completed: graph, impact, indexer, pipeline, and per-language
parser suites — 141 tests / 20 files, vitest green. See the old entry
below for the historical stub list.

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
- Remaining `packages/git/*` (`checkoutBranch`, `detectDefaultBranch`,
  `getBranches`, `getCommitHistory`, `getContributors` — different from
  `cloneRepository`/`cleanupRepository`/`readGitignore`, which are already
  done)
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

**Status:** Not Started

Confirmed via grep: zero references to Explorer in apps/web/app. Component exists, works standalone, but no page renders it. Worth prioritizing -- a working workspace/explorer view is probably what makes ARCLUX feel alive to new visitors vs just a graph viewer.
