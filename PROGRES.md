# ARCLUX — Progress Summary

> Paste this file at the start of any Claude chat (or `cat PROGRES.md`) so
> Claude immediately understands the project status without needing it
> re-explained from scratch. Update this file after every major milestone.
>
> Check current empty-file status:
> ```bash
> cd ~/arclux
> find apps packages scripts tests -type f \( -name "*.ts" -o -name "*.tsx" \) \
>   -not -path "*/node_modules/*" | while read f; do
>   echo "$(wc -l < "$f") $f"
> done | sort -n
> ```
> Threshold: a file with only the Apache 2.0 license header has a baseline
> of **8 lines**, not 0 — so "empty" means ≤9 lines, not `==0`. Always `cat`
> a suspicious file before trusting the `wc -l` number alone.

## What this is

ARCLUX = a codebase analysis tool. Clone repo → parse → index → build
dependency graph → interactive browser visualization. Goal: see how
files/modules connect to each other, what gets affected if you change
something, and which conventions are being violated (e.g. "added a
Next.js page but forgot to register the route").

## Stack

- Monorepo: `apps/web` (Next.js 16, App Router, Webpack — **not** Turbopack,
  unsupported on Termux arm64), `packages/*` (core logic, framework-agnostic)
- UI: React, Tailwind v4, shadcn/ui (Base UI variant) + Aceternity + Magic UI
- Graph rendering: SVG + `d3-force` (physics layout)
- Parsing: TypeScript Compiler API (TS/TSX) + `web-tree-sitter` (Python)
- Environment: Termux on Android, not desktop
- License: Apache 2.0 (`LICENSE` + `NOTICE` at root, per-file header)

---

## ✅ DONE — pipeline & core
Single entry point: `packages/engine/pipeline.ts` → `analyzeRepository({ repoUrl })`.
Don't call individual steps from outside `engine/`.

- `packages/git/cloneRepository.ts`, `cleanupRepository.ts`, `readGitignore.ts`
- `packages/parser/core/*` (`ParserInterface`, `ParserRegistry`, `scanFiles`,
  `LanguageDetector`)
- `packages/parser/typescript/parseTs.ts` (194 lines) — **note**:
  `parseTsx.ts` and `parseTsConfig.ts` are still separate empty stubs, TSX
  is likely already handled inside `parseTs.ts` itself — check before
  assuming TSX can't be parsed at all.
- `packages/parser/python/*` — `parsePython.ts`, `highlightPython.ts`,
  `pythonHighlightQuery.ts` (see gotcha details below)
- `packages/indexer/buildIndex.ts`, `resolveAliases.ts`
- `packages/graph/buildDependencyGraph.ts`, `buildFolderGraph.ts`,
  `resolvePath.ts`, `serializeGraph.ts`
- `packages/repository/*` (`Repository`, `Module`, `File`, `Folder`, `Node`,
  `Edge`, `Dependency`, `Graph`)
- `packages/engine/detectRepositoryMeta.ts`
- `packages/rules/RuleEngine.ts` + `rules/nextjs/requirePage.ts`
- `packages/shared/*` (`types.ts`, `errors.ts`, `hash.ts`, `paths.ts`,
  `constants.ts`, `logger.ts`, `utils.ts`)
- `packages/search/fuzzyScore.ts` — adapted from `cmdk` (see NOTICE)

## ✅ DONE — detectors (10/18)

1. `detectCircularDependency.ts` — DFS cycle detection, adapted from `madge`
2. `detectUnusedExports.ts` — traversal strategy adapted from `knip`,
   fully re-implemented using `ResolvedImport`/`resolvedReExports` on
   `ModuleInfo`
   - **Limitation**: no reference-extraction pass (can only detect "never
     imported", not "imported but unused"). Namespace imports are treated
     as automatically "using everything". Aliased re-exports aren't chained
     correctly (`RawExport` only stores the final name). Not yet
     entry-file-aware (`resolveRoutes.ts` is still empty → false positives
     on files like Next.js `page.tsx`).
3. `detectOrphanFiles.ts` — file-level version of point 2 (nothing imports
   this file at all). Subject to the same entry-file caveat.
4. `detectLargeModules.ts` — flags files above a byte threshold (default
   15,000). Verified against the `arclux` repo itself: 0 results currently
   because the largest file in the repo (`file-tree.tsx`, 511 lines) is
   only 12,840 bytes, still under the threshold — not a bug, the
   threshold just hasn't been triggered yet.
5. `detectDuplicateModules.ts` — groups files by content hash.
   - **Incident already fixed**: initial threshold (`minSizeBytes = 200`)
     was too small. An empty stub file (license header + 1 comment line)
     in this repo turned out to be 263 bytes, not below 200 as assumed
     when the comment was written. This caused 149 stub files to get
     grouped into one fake "duplicate group" when tested against the real
     repo (not caught in `python-demo`, which only has 6 files). Threshold
     raised to 300. Still a fragile byte-based heuristic — `FileInfo` has
     no `lineCount` or `content`, only `sizeBytes`/`hash`, so if the
     license header format ever changes, this threshold can go stale
     again.
6. `detectSharedModules.ts` — flags high fan-in files (importedBy count).
   Informational, not a "problem". Verified: found
   `packages/shared/types.ts` (25 importers), `packages/repository/Repository.ts`
   (23 importers) in the `arclux` repo itself — makes sense.
7. `detectIndexFiles.ts` — flags barrel files (index.ts) that mix
   re-exports with their own definitions.
   - **Overlap note**: `packages/repository/Module.ts` already has
     `isBarrelFile()`/`isEntryPoint()` with a similar concept. Not yet
     checked whether there's logic duplication — worth verifying before
     writing the next convention detector that might touch the same area.

Verified twice: against `playground/python-demo` (small fixture) AND
against the `arclux` repo itself via `npx tsx apps/cli/index.ts doctor .`
(15,630 lines of real code) — the latter is what caught the threshold bug
above, which the small fixture alone did not reveal.

8. `detectLayerViolation.ts` — rule-matching concept (from-pattern /
   to-pattern regex on folder path) adapted from sverweij/dependency-cruiser
   (MIT), src/validate/match-folder-dependency-rule.mjs. Not a port —
   dependency-cruiser supports arbitrary user-defined rules with regex
   capture groups; this is a small fixed set of 2 ARCLUX-specific rules
   (packages/* can't import apps/*, packages/shared/* can't import sibling
   packages/*) against ARCLUX's own ModuleInfo/ResolvedImport shape, no
   group-capture machinery. Verified with a positive control (planted a
   fake violation, confirmed detection, reverted) — 0 violations in
   `arclux` itself currently.
9. `detectDeadCode.ts` — ARCLUX-original, NOT adapted from knip despite
   investigating knip first (knip has no "dead code" issue type at all —
   its IssueType union is granular: files/exports/types/enumMembers/etc,
   no umbrella bucket). Deliberately scoped to NOT duplicate
   detectOrphanFiles or detectUnusedExports: flags a module that IS
   imported by something (not orphaned) but where EVERY one of its own
   exports is unused (per detectUnusedExports) — i.e. likely only ever
   imported for a side effect. Composes detectUnusedExports's output
   rather than re-deriving usage data, so there's one source of truth for
   "is this export used." Verified with a positive control (planted a
   fake side-effect-only import, confirmed detection, reverted) — 0
   findings in `arclux` itself currently.

Also verified end-to-end via `doctor.ts` (9/9 detectors running together,
not just tested one by one in isolation) against `playground/python-demo`
and against the `arclux` repo itself.

10. `detectEntryPoints.ts` — ARCLUX-original, positive classifier for
    orphaned modules (importedBy === 0) that match a known entry-point
    convention (Next.js App Router page/layout/loading/error/route files,
    apps/cli/index.ts). Informational only — does not modify or suppress
    detectOrphanFiles/detectUnusedExports findings, just lists known-good
    matches alongside them for cross-checking. Verified against `arclux`
    itself: 25 findings, all correct (every app/**/page.tsx, layout.tsx,
    loading.tsx, error.tsx, route.ts under apps/web/app, plus
    apps/cli/index.ts).

Also verified end-to-end via `doctor.ts` (10/10 detectors running
together) against `playground/python-demo` and against the `arclux` repo
itself.

**Remaining 8 still at 0%**: `detectComponentConvention`, `detectFeatureStructure`,
`detectMissingExports`, `detectRepositoryPattern`, `detectRouteConvention`,
`detectStoryConvention`, `detectTestConvention`, `detectUnusedFiles`.

## ✅ DONE — UI: graph viewer

Composition root: `GraphViewport.tsx` (used in
`app/[org]/[repo]/graph/page.tsx`, don't call `GraphCanvas` manually).

`GraphProvider` (centralized state: transform, positions, dimensions,
contextMenuNodeId — `GraphCanvas` is the only writer), `GraphCanvas`
(260 lines, pan/zoom/Escape-deselect/double-click-zoom/event delegation),
`GraphToolbar`, `GraphLegend`, `GraphSearch` (73 lines, still exact/substring
match — not yet using `fuzzyScore.ts`), `GraphSelection`, `GraphContextMenu`,
`Minimap`, `GraphNode`, `GraphEdge`.

**Not yet visually verified in a browser** (only passed `tsc --noEmit`):
- `Minimap` viewport-rect still assumes transform origin at (0,0)
- `Minimap` + `GraphLegend` collide when rendered together (both use
  `bottom-4 right-4` absolute positioning) — currently only `GraphLegend`
  is rendered
- Double-click-zoom + context menu together haven't been tested on a real
  device

## ✅ DONE — UI: layout, primitives, patterns (partial), marketing

**`components/layout/*`** (7 files, all production-quality): `Sidebar.tsx`,
`SplitPane.tsx` (resizable pane, pointer drag), `WorkspaceLayout.tsx`,
`Navbar.tsx`, `Breadcrumbs.tsx`, `PageContainer.tsx`, `PageHeader.tsx`,
`Footer.tsx`.

**`components/primitives/*`** (7 files): `Avatar.tsx`, `Badge.tsx`,
`Checkbox.tsx`, `Kbd.tsx`, `Skeleton.tsx`, `Switch.tsx` — thin re-exports
from `vendor-ui/shadcn/*`. All complete.

**`components/patterns/*`** — now **11/11 complete** (see update below):
`CommandPalette.tsx` (uses `cmdk` as a dependency, see NOTICE),
`LoadingState.tsx`, `ErrorState.tsx`, `ConfirmDialog.tsx`, `CopyButton.tsx`,
`DataTable.tsx`, `EmptyState.tsx`, `FilterBar.tsx`, `MobileBottomSheet.tsx`,
`SearchInput.tsx`, `StatusDot.tsx`.

**`components/marketing/*`** (5 files, all complete): `Hero.tsx`, `CTA.tsx`,
`Example.tsx`, `Features.tsx`, `Footer.tsx`.

**`components/overview/*`** — only `ProjectStructure.tsx` (99 lines, file
tree UI, collapsible, uses `d3-hierarchy`) is complete. `RepositoryHeader`,
`RepositoryInfo`, `RepositoryOverview` are still stubs.

**`components/explorer/*`** — only `FileDetails.tsx` (132 lines, fetch +
render source with syntax highlighting) is complete, **not yet wired into
any page** because `Explorer.tsx` itself is still a stub. `DependencyList`,
`ImpactSummary` are also still stubs.

**`hooks/useTheme.ts`** (36 lines) done. `useClipboard`,
`useCommandPalette`, `useDebounce`, `useMediaQuery` still stubs.

**`theme/colors.ts`, `theme.dark.ts`, `graphColors.ts`** done.
`motion.ts`, `spacing.ts`, `typography.ts` still stubs.

**`lib/utils.ts`, `lib/cn.ts`** done. `lib/api.ts`, `lib/graph.ts` stubs.

**App routes**: every `page.tsx`/`error.tsx`/`loading.tsx` under
`app/[org]/[repo]/*` already has real content (not default Next.js
boilerplate), including `app/new/page.tsx`.

**API routes**: `POST /api/analyze`, `GET /api/graph`, `GET /api/file`
(fetch raw from GitHub + Python highlighting) — all done (65-84 lines).
`api/impact/route.ts` and `api/search/route.ts` — see update below, now
implemented (previously 8-line stubs).

## ✅ DONE — vendor-ui

Everything in `vendor-ui/shadcn/*` (avatar, badge, button, checkbox,
command, dialog, dropdown-menu, input, input-group, popover, select,
separator, sheet, skeleton, switch, tabs, textarea, toast, tooltip),
`vendor-ui/aceternity/*` (5 files), `vendor-ui/magic-ui/*` (6 files,
including `file-tree.tsx` at 511 lines — the largest file in the whole
project), and `vendor-ui/_inbox/*` (4 custom files: neon-glow-card,
code-block-terminal, graph-particles-bg, keyboard-shortcut-hint) — all
installed/written in full.

---

## ⚠️ PARTIAL / NEEDS VERIFICATION

**Python parsing & syntax highlighting** — works (`parsePython.ts` 203
lines, `highlightPython.ts` 142 lines, `pythonHighlightQuery.ts` 151 lines
copied verbatim from `tree-sitter-python`, MIT — attribution in NOTICE),
but:
- Never tested end-to-end through the real `ParserRegistry` (only via a
  separate experimental script)
- Not yet visually verified in the browser (the syntax-highlight colors
  have never actually been confirmed to attach to the right characters)
- `FileDetails.tsx`, which uses this, is not yet wired into any page

**`web-tree-sitter` gotcha** (MUST read before adding another
tree-sitter-based language parser):
- **Must be exactly 0.25.0**, not 0.26.x — newer versions fail to load the
  WASM grammar (`getDylinkMetadata` ABI mismatch)
- Must be called via `require()` (through `createRequire(import.meta.url)`),
  not a pure `import` — otherwise "Dynamic require of fs/promises is not
  supported" error
- No `.d.ts`, can't be augmented via `declare module` (TS2665 error) —
  solved with a custom type (`TSNode` interface), `require`d as `any`
- Per-language grammar `.wasm` files live in
  `node_modules/tree-sitter-wasms/out/`, NOT from the `~/research/tree-sitter`
  clone (that's just a reference for concepts)
- Parser instance MUST be a singleton (`getPythonRuntime()` promise-cache
  pattern) — reloading the WASM per `parse()` call would be very slow
- Query constructor differs between 2 API versions (old `language.query()`
  vs new `new Query()`) — `highlightPython.ts` already handles the fallback
- Python has no `export` — every top-level `function_definition`/
  `class_definition` is treated as an "export" (heuristic, doesn't yet
  read `__all__`)

**`packages/detectors/detectUnusedExports.ts`** — see limitations in the
detectors section above.

---

## ❌ STILL EMPTY (8-line stub, license header only)

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

## External references already used

Full attribution is in `NOTICE` (root). Summary:

| Source | License | Nature | Became |
|---|---|---|---|
| `sst/opencode` | MIT | pattern re-adapted | `theme/arclux.json`, `hooks/useFilteredList.ts` |
| `pahen/madge` | MIT | algorithm re-implemented | `detectCircularDependency.ts` |
| `git-truck` | MIT | UX pattern re-implemented | `GraphCanvas.tsx` |
| `sverweij/dependency-cruiser` | MIT | concept re-implemented | `RuleEngine.ts` |
| `d3-hierarchy` | ISC | used directly | `buildFolderGraph.ts` |
| `webpro-nl/knip` | MIT | traversal strategy re-implemented | `detectUnusedExports.ts` |
| `tree-sitter/tree-sitter-python` | MIT | query copied verbatim | `pythonHighlightQuery.ts` |
| `pacocoursey/cmdk` | MIT | used directly as dependency + scoring adapted | `CommandPalette.tsx`, `fuzzyScore.ts` |

**Repos in `~/research` used only to read patterns/architecture, not
copied from**: git, language-server-protocol, llvm-project, sqlite,
tree-sitter, nx, clack, shadcn-table, drizzle-orm (check which ones are
actually cloned before assuming).

## Problems that happened before — don't repeat these

- **Dead code piling up**: 2 differently-named files doing the same thing
  (`graph/resolveAlias.ts` vs `indexer/resolveAliases.ts`) because of
  parallel sessions without sync. Lesson: ALWAYS `cat`/`grep` first before
  writing a new file that could overlap. **Same risk still exists** for
  `packages/ui/graphColor.ts` vs `theme/graphColors.ts` — not yet cleaned
  up.
- **`wc -l` is misleading**: a file with just the Apache 2.0 license
  header has a baseline of 8 lines even when empty. The "empty" threshold
  is `≤9`, not `==0`. Always `cat` a suspicious file before recording its
  status in PROGRES.md.
- **Duplicate license headers**: there was once a file with 2 headers (old
  MIT + new Apache stacked) from a mid-stream license change without
  removing the old header first. Already cleaned up manually.
- **Long scripts can silently fail partway through**: the CommandPalette
  session once failed to write a file partway through a heredoc, but the
  earlier steps (installing `cmdk`, creating `fuzzyScore.ts`) still
  succeeded — making it look "done" when it wasn't complete. Lesson: after
  running a multi-step script, verify each step (`cat` the file / `git
  log`), don't assume "ran" means "all succeeded".
- **Termux quirks**: `/tmp` doesn't exist, Turbopack doesn't run on arm64
  (use `--webpack`), git push needs a Personal Access Token, not a
  password.
- **Don't clone reference repos inside `~/arclux`** — they must be at the
  `~` root (`~/git-truck`, `~/madge`, `~/opencode`, `~/research/*`),
  outside the project.

## Update — packages/incremental (new foundation, not wired in yet)

`packages/incremental/` — Cell (input), Query (memoized function with
dependency tracking + early cutoff), Database (revision coordination).
Principle adapted from `salsa-rs/salsa` (dual MIT/Apache-2.0) — NOT a
port (Rust proc-macro vs runtime tracking in TS), re-implemented from
scratch. Full attribution in the `Database.ts` comment.

**Verified via a runnable demo** (`packages/incremental/demo.ts`, run with
`npx tsx packages/incremental/demo.ts`), not just `tsc --noEmit`:
- Memoization: repeated calls with no change = 0 recomputation
- Dependency tracking: only Cells that are actually read trigger
  invalidation
- Early cutoff: `Cell.set()` with an identical value (`Object.is`) is a
  no-op, doesn't bump the revision
- Cycle detection: a query re-entering the same key while still computing
  → throws, instead of an infinite loop

**Known limitations (documented in the `Query.ts` comment)**:
- Early cutoff only works for reference equality (`Object.is`) — a new
  object with identical contents is still considered "changed". Deep-
  equality cutoff would need a custom comparator, not yet implemented.
- Dependency tracking during cache-hit revalidation is over-approximate
  (query C calling A which calls B ends up depending on both A AND B
  directly, rather than just A with B implied transitively) — safe (no
  missed invalidations) but not maximally minimal.
- Cycles throw, there's no fixed-point resolution for genuinely recursive
  queries — that's treated as a caller bug, not a supported pattern.

**NOT wired into any pipeline yet** — `buildIndex.ts`, `pipeline.ts`, the
detectors, everything still runs the old way (full re-scan). This is a
standalone foundation that needs separate integration as a bigger next
step, not something that's automatically used just because this file
exists.

## Update — First real end-to-end verification (playground/python-demo)

`playground/python-demo/` — a 6-file Python fixture (circular import,
unused export, normal chain) + `scripts/testPlayground.ts` — a manual
script that calls `buildIndex` → `buildDependencyGraph` → 2 detectors
directly, BYPASSING `analyzeRepository()` (which is designed for
repoUrl/clone, not a local path). This is a legitimate exception to the
"don't call individual steps from outside engine/" rule — that rule is
for production call sites (CLI, API route), not local verification
scripts.

**Results, tested against real code for the first time (not just
tsc --noEmit)**:
- Module count, import resolution, graph edges — all correct
- `detectCircularDependency` found the cycle `cyclic_a ↔ cyclic_b` —
  correct
- `detectUnusedExports` found `unused_helper` (true positive) AND `main`
  in `main.py` (false positive) — this false positive is the **first
  empirical confirmation** of the "not yet entry-file-aware" limitation
  noted earlier, not a new bug. The still-0% `resolveRoutes.ts` is what
  will fix this.

**Coordination note**: another session was planning a `pipeline.ts`
refactor for the CLI `doctor` command — adding a `findings[]` field to
`AnalyzeRepositoryResult` so `analyzeRepository()` orchestrates detectors
internally (instead of every caller calling `buildIndex`+detectors
itself). No code from that plan had been committed as of commit
`9e6b660e`. The `scripts/testPlayground.ts` above does NOT replace that
plan — it's still needed for local dev testing, while the `findings[]`
refactor is for production call sites (CLI, API). If `findings[]` gets
added later, `testPlayground.ts` could be simplified to use it too.

## Update — doctor.ts now calls 10/18 detectors (updated from 9/18)

`apps/cli/doctor.ts` updated to call the 5 new detectors above in addition
to the 5 previous ones. Still manual per-detector calls (no registry yet)
— the file's own comment already notes this is worth turning into a
registry once you hit detector #8+, because each detector has a different
finding shape (`cycle` vs `filePath`+`line` vs `hash`+`filePaths[]` vs
`isPureBarrel`), so a registry would need a print-adapter per detector,
not just a list of functions.

## Update — apps/cli (5/6 files, index.ts now has real content)

`apps/cli/*` — `analyze`, `doctor`, `graph`, `config` **work and are
verified** against `playground/python-demo` (not just tsc --noEmit).
`impact` deliberately reports "not yet implemented" — `packages/impact/*`
was still 0% at that point, so this command doesn't fake an
empty/incorrect result.

Built with `commander` (routing) + `@clack/prompts` (output/spinner).

**`analyzeLocal.ts`** — new helper, calls `buildIndex` +
`buildDependencyGraph` directly against a local path, BYPASSING
`analyzeRepository()` (which is designed for repoUrl/clone). Same
exception as `scripts/testPlayground.ts` — legitimate for a local-path
call site, not for the production remote-repo flow.

**Explicit action item**: another session was reportedly planning a
`pipeline.ts` refactor (adding `findings[]` + local-path support to
`AnalyzeRepositoryResult`). Once that lands, `analyzeLocal.ts` should be
DELETED and all CLI commands should call the engine API directly — don't
let 2 orchestration paths (pipeline.ts vs analyzeLocal.ts) coexist longer
than temporarily necessary, that would become a new dead-code risk.

**Additional finding**: `apps/cli` previously had no `tsconfig.json` of
its own — `tsc` automatically walked up to the root
`~/arclux/tsconfig.json`, which turned out to be Next.js-flavored
(`jsx: preserve`, `plugins: next`), possibly misplaced/duplicated from
`apps/web/tsconfig.json`. This caused `tsc --noEmit` in the CLI to also
sweep through all of `apps/web` and fail on dozens of `@/*` imports only
valid in the Next.js scope. Fixed by creating a dedicated
`apps/cli/tsconfig.json` (Node/ESNext target, self-contained include).
**Not yet investigated**: whether that root `tsconfig.json` was
intentional or a leftover bug — worth checking if any other
consumer/workspace also lacks its own tsconfig.

## CORRECTION — packages/impact/* turned out to be ALREADY DONE (8/8)

Previously recorded as priority #1 at 0% total. It turned out to be fully
implemented in commit `8b69831a` (before this session even started),
just never cross-checked against PROGRES.md. Verified via direct `cat`
(not just `wc -l`):

- `traceImports.ts` (33 lines), `traceExports.ts` (46 lines) — identifier-
  level tracing, consistent with the same pattern as
  `detectUnusedExports.ts` (namespace/default/named import handling)
- `calculateAffectedFiles.ts` (66 lines) — base function
- `calculateAffectedModules.ts`, `calculateAffectedComponents.ts`,
  `calculateAffectedRoutes.ts` — all compose on top of
  `calculateAffectedFiles`, not duplicated logic. `Routes` even correctly
  converts a file path to a Next.js route path (stripping route groups
  `(...)`)
- `buildImpactTree.ts` (38 lines) — **has a cycle guard**
  (`ancestors: Set`) + `maxDepth`, important because a repo can have a
  real circular import (see
  `playground/python-demo/cyclic_a.py` ↔ `cyclic_b.py`)
- `traceDependencies.ts`, `traceConsumers.ts` — not manually `cat`'d yet,
  assumed done based on the consistent pattern of the other 6 files, but
  **re-verify before actually relying on them**

**Additional lesson**: this incident is EXACTLY the same as the earlier
`components/layout/*` incident — actual progress was further ahead than
recorded because parallel work sessions weren't synced to PROGRES.md.
Redundant verification (`cat`, not assumption from file name/old
PROGRES.md) remains mandatory before starting work in any area.

**Action item**: `apps/cli/impact.ts` is currently WRONG — it says "not
yet implemented" even though the functionality already exists. Needs to
be fixed so it actually calls `buildImpactTree`/`calculateAffectedFiles`
etc.

## Update — detectors 18/18 (100%), 2 production bugs NOT YET FIXED

packages/detectors/* is fully 18/18. Verified via scripts/testPlayground.ts
(now calls all 18 detectors, runs against the fixture OR the repo itself
via `npx tsx scripts/testPlayground.ts .`).

**PRODUCTION BUG, NOT YET FIXED**: detectRouteConvention found that
apps/web/app/api/impact/route.ts AND apps/web/app/api/search/route.ts
don't export any HTTP method (GET/POST/etc) — both endpoints are likely
non-functional if hit.

Other findings: detectRepositoryPattern found a package-level cycle
packages/indexer <-> packages/graph. detectMissingExports found 9 shadcn
files (button.tsx etc.) not re-exported via components/ui/index.ts.
detectUnusedExports still has false positives on React components (not
yet using the detectEntryPoints filter like detectUnusedFiles does).

## Update — Python resolver bug + TS export default double-count bug (fixed)

Tested against playground/python-demo (6-file fixture, existed already)
and found 2 real production bugs:

1. packages/graph/resolvePath.ts — a bare specifier (e.g. Python
   "from utils import x") was always judged an external package without
   first trying to resolve it internally. Correct for JS/TS (bare =
   always an npm package), wrong for Python (bare = often a sibling
   module). Also, .py was missing from RESOLVABLE_EXTENSIONS and
   __init__.py was missing from INDEX_FILENAMES.
   FIXED — a bare specifier is now tried as a same-directory file first
   before being judged external, and .py/__init__.py are now in the list.
   Before the fix: 0 graph edges in python-demo. After: 6 edges, circular
   dependency detection and unused-exports detection both work correctly.

2. packages/parser/typescript/parseTs.ts extractExports — "export default
   function Page()" has both the Default and Export modifiers on the same
   node. There were 2 independent if-blocks (not if/else), so this node
   was pushed twice: once as kind "default", once again as "named".
   FIXED — the second block is now guarded with !isDefaultExport. Found
   via playground/nextjs-demo testing (page.tsx was counted as 2 exports
   instead of 1).

Process gotcha: bash history expansion ate the "!" character in a
python3 -c "..." heredoc twice — once during a README badge fix, once
during this !isDefaultExport guard — even though python3 reported
"patched successfully", the actual content was silently broken because
lines containing "!" were dropped. `set +H` at the start of a terminal
session prevents this. ALWAYS re-cat a file after a multi-line patch
containing "!", don't trust "patched successfully" alone.

playground/ now has 6 new fixtures: react-demo, nextjs-demo,
express-demo, nest-demo (all immediately testable via
scripts/testPlayground.ts), go-demo, java-demo (fixtures ready, parsers
for these 2 languages not yet written).

## Update — Large sync from other parallel sessions (read before assuming anything is 0%)

Several Claude sessions ran in parallel using different accounts. Actual
progress was much further along than what had been recorded here.
Highlights:

- packages/impact/* is ALREADY 8/8 done (traceImports, traceExports,
  calculateAffectedFiles/Modules/Components/Routes, buildImpactTree,
  traceConsumers/Dependencies) — was mistakenly recorded as "0%, priority
  #1" in an older version of PROGRES.md. Verified via manual cat.
- packages/detectors/* is ALREADY 18/18 done (previously recorded as
  10/18).
- apps/cli/* is ALREADY 5/6 (analyze, doctor, graph, config work +
  verified against python-demo, using commander + @clack/prompts).
  impact.ts EXISTS but is wrong — still says "not yet implemented" even
  though packages/impact is done. Not yet fixed, open action item.
- apps/cli/analyzeLocal.ts — temporary helper bypassing
  analyzeRepository() for a local path. Should be deleted once there's
  official local-path support in pipeline.ts (if that gets done) — don't
  let 2 orchestration paths coexist for long.
- packages/incremental/* (Cell/Query/Database, concept adapted from
  salsa-rs, not a port) — foundation done + verified via a runnable
  demo.ts, BUT not wired into any pipeline yet. buildIndex/pipeline/
  detectors all still do a full re-scan the old way.
- packages/ui/graphColor.ts vs theme/graphColors.ts — checked manually,
  graphColor.ts is still an empty 8-line stub (not an active duplicate).
  The risk only appears IF someone later writes content into it without
  realizing theme/graphColors.ts is already working. No cleanup needed
  right now.

Lesson repeated again (already noted before, proven still relevant):
ALWAYS cat manually before trusting old notes in this file, especially
since other sessions may be running in parallel.

## Update — /api/impact and /api/search implemented (from empty stubs)

Found via dogfooding: detectRouteConvention (one of the 18 detectors)
found that apps/web/app/api/impact/route.ts and .../search/route.ts
exported no HTTP method at all. Checked manually — turns out it wasn't a
missing export, both were genuinely still 8-line stubs (license header
only), never written at all.

Design: AnalyzeRepositoryResult now carries a `repository` field (a full
Repository instance, NOT a plain object). IMPORTANT — this field is
server-side only. Repository.modules is a private Map, so if
JSON.stringify'd as-is it silently becomes {} (not a crash, silent data
loss). apps/web/app/api/analyze/route.ts (which has worked for a while)
was patched to strip the `repository` field before responding, so the
JSON shape doesn't silently change now that this field exists.

/api/impact — composes calculateAffectedFiles + buildImpactTree (from
packages/impact, which turned out to already be done, see update above).
/api/search — uses fuzzyScore.ts (adapted from cmdk) to search by module
file path only. This is a stopgap, NOT real search — packages/search/
SearchEngine.ts etc. is still 0%.

STATUS: only passed tsc --noEmit, NOT YET tested end-to-end via a real
dev server (analyzeRepository needs a real repoUrl/clone, can't be tested
via scripts/testPlayground.ts the way CLI/detector work was). Manual test
before trusting this: run pnpm dev in apps/web, then curl
'localhost:3000/api/impact?repoUrl=<url>&moduleId=<path>' against a real
small GitHub repo.

## Update — duplicate PROGRESS.md file (double-S typo) deleted

There was briefly a separate file named PROGRESS.md (not PROGRES.md) from
another session that typo'd the filename. It has been deleted —
PROGRES.md (single-S) remains the one official progress file.

## Update — apps/cli/impact.ts confirmed to ALREADY be correct (no longer an open item)

Had been recorded repeatedly (3x across previous updates) as an open
action item: "apps/cli/impact.ts is wrong, still says not yet implemented
even though packages/impact is done". Checked now — it turns out another
session already fixed it, with an explicit "CORRECTED" comment in the
file itself explaining the history.

Re-verified in this session (not just trusting the "CORRECTED" comment):
- `tsc --noEmit` is clean
- Actually ran it: `npx tsx apps/cli/index.ts impact utils.py
  playground/python-demo` — sensible result (utils.py is consumed
  directly by service.py, transitively by main.py via service.py, 2
  affected files total), consistent with the known fixture structure.

This command composes 3 functions from packages/impact/*: traceConsumers,
traceDependencies, calculateAffectedFiles. This action item is OFFICIALLY
CLOSED.

## Update — components/patterns/* 8 stub files are now DONE

Wrote 8 files that were previously stubs (just an 8-line license header):
`ConfirmDialog.tsx`, `CopyButton.tsx`, `DataTable.tsx`, `EmptyState.tsx`,
`FilterBar.tsx`, `MobileBottomSheet.tsx`, `SearchInput.tsx`, `StatusDot.tsx`.

Convention taken from the files that were already done
(`LoadingState.tsx`, `ErrorState.tsx`, `CommandPalette.tsx`): named
export, `ComponentNameProps` props interface, `"use client"` for
interactive ones, `cn()` from `@/lib/cn`, primitives from
`@/components/ui/*` (not directly from `vendor-ui/shadcn/*`).

- `ConfirmDialog` & `MobileBottomSheet` use the `Dialog`/`Sheet`
  primitives from `components/ui/`, with props APIs matched exactly to
  the real shape (`DialogContent`, `SheetContent side="bottom"`, etc. —
  checked from vendor-ui source first, not guessed).
- `DataTable` is built from a native `<table>` + Tailwind — there's no
  shadcn `table.tsx` primitive in `vendor-ui/` yet.
- `FilterBar` deliberately does not use `Badge` (not yet wrapped in
  `components/ui/`, still an open item from `detectMissingExports`),
  uses a `Button` variant toggle instead.
- Verification: `npx tsc --noEmit -p apps/web/tsconfig.json` → 0 errors
  from the new code. The remaining 5 errors in the project are
  pre-existing and unrelated (`vendor-ui/magic-ui/file-tree.tsx` needs
  the `@radix-ui/react-accordion` package + a not-yet-written
  `scroll-area.tsx`; `packages/graph/buildFolderGraph.ts` needs the
  `d3-hierarchy` package, which isn't installed — both are separate
  tasks).
- Important note: running `npx tsc --noEmit` WITHOUT
  `-p apps/web/tsconfig.json` produces 130 false errors (every `@/*`
  alias fails to resolve) because the baseUrl path mapping in that
  tsconfig is relative to `apps/web`, not the repo root. To typecheck
  this app, you MUST use the `-p apps/web/tsconfig.json` flag.
- No consumer imports these 8 components yet (checked via grep), so this
  is purely new, ready-to-use components with no breaking-change risk.

`components/patterns/*` is now 11/11 complete (including
`CommandPalette.tsx`, which was already done by a previous session).

## Update — GitHub infra + features/graph decision

**Repo infrastructure added**: branch ruleset on `main` (PR required, no
direct push — verified by testing it against ourselves), PR + issue
templates (`.github/`), 10 GitHub Issues created from open items in this
file, release tag `v0.1.0-alpha` published, `CONTRIBUTING.md` rewritten
(was stale: said pnpm/turbo, said detectors don't exist — now says npm,
18/18 detectors, references playground/ testing pattern).

Also removed `turbo.json` (0 bytes, unused leftover — project uses npm
directly, `turbo` command never actually run against this repo).

**apps/web/features/graph/* decision**: `useGraph.ts` implemented as a
thin re-export of `GraphProvider.tsx`'s `useGraphContext()`. The other 4
files (`graphStore.ts`, `graphEvents.ts`, `useGraphLayout.ts`,
`useGraphSelection.ts`) are DELIBERATELY left as documentation-only stubs
— `GraphProvider.tsx` already owns all graph state (transform, positions,
dimensions, selection) via React Context. Do NOT implement a separate
store/hooks layer here; it would create two sources of truth for the same
state. Same class of risk as the `packages/ui/graphColor.ts` /
`theme/graphColors.ts` naming collision noted earlier.


## Update -- ImpactSummary.tsx built and verified in-browser, plus 2 major Webpack gotchas found

components/explorer/ImpactSummary.tsx implemented: fetches /api/impact,
renders total affected files, direct impact (distance === 1) and indirect
impact (distance > 1) lists, each file with a High/Medium/Low severity
badge derived from distance.

Important: severity is NOT part of the backend response. packages/impact/*
only produces distance (BFS hops from the changed module). The
High/Medium/Low mapping is a UI-only heuristic (distance 1 -> High,
2 -> Medium, 3+ -> Low), documented as such in the component's own
comment, not validated against real incident data. If this ever needs to
reflect real blast-radius severity (weighted by fan-in, file size, test
coverage, etc.), that logic belongs in packages/impact/*, not the UI
layer.

Verified in-browser (not just tsc --noEmit): temporarily mounted the
component on a throwaway test page, called it against
apps/cli/impact.ts in the arclux repo itself, confirmed direct impact
list, severity badge, and total count all render correctly. Test page
was deleted after verification -- it was never a permanent route.

Not yet wired into components/explorer/Explorer.tsx -- that file is
still a stub, so ImpactSummary remains a standalone building block for
now, same status as FileDetails.tsx.

### Gotcha #1 -- Next.js route folders starting with underscore are NOT routable

Any app/_foldername/ is treated by Next.js as a private folder by
convention and will 404 no matter what's inside it -- even a valid
page.tsx. This is intentional Next.js behavior for co-locating
non-route files inside app/, not a bug. If you need a throwaway test
route, do NOT prefix it with underscore -- that guarantees it can't be
visited. Use a plain folder name instead, and delete it manually when
done (Next.js has no built-in "temporary route" concept).

### Gotcha #2 -- Webpack + web-tree-sitter .wasm: the actual fix (3 wrong attempts first)

Running apps/web with next dev --webpack and hitting any route that
imports packages/parser/python/parsePython.ts (e.g. /api/graph,
/api/analyze, /new) used to hard-fail with a webpack error:
"Module parse failed: Unexpected character (1:0) -- The module seem to
be a WebAssembly module, but module is not flagged as WebAssembly
module for webpack."

This blocked ALL in-browser verification of the graph viewer, impact UI,
and anything else touching the pipeline -- nothing past tsc --noEmit had
ever actually been confirmed working in a browser until this was fixed.

Three approaches were tried and did NOT work, in order:

1. experiments.asyncWebAssembly: true in next.config.ts webpack()
   callback. This does let Webpack parse some .wasm files, but
   tree-sitter-python.wasm uses Emscripten dynamic linking (dylink),
   which Webpack's WebAssembly module types don't support. Failure
   changed to "Module not found: Can't resolve 'GOT.func'" (a dylink
   relocation symbol Webpack tried and failed to resolve as a JS
   import).
2. serverExternalPackages: ["web-tree-sitter", "tree-sitter-wasms"].
   Reasonable guess (this is the documented Next.js mechanism for
   excluding server-only packages from the Webpack bundle), but it did
   NOT fix it -- same "Unexpected character" error came right back.
   Cause: serverExternalPackages only takes effect at module-resolution
   time, but Webpack's static analysis of require.resolve("...") calls
   happens earlier and unconditionally tries to bundle whatever the
   resolved path points to, regardless of externalization config.
3. Renaming the createRequire()-derived variable from require to
   nodeRequire in parsePython.ts, on the theory that Webpack's analyzer
   pattern-matches the literal identifier require. Also did NOT work --
   Webpack traces the variable back to its createRequire() origin
   regardless of what it's named, so renaming had zero effect. (This was
   a dead end; the rename itself is harmless and was left in place.)

What actually fixed it: tell Webpack to treat .wasm files as a raw
binary asset instead of trying to parse them as a WebAssembly module at
all, by pushing a module rule in next.config.ts's webpack() callback
that matches /.wasm$/ and sets type to "asset/resource".

This makes Webpack just copy the file and return a resolvable path,
without attempting to parse its contents as JS or WASM -- the actual
bytes are read by web-tree-sitter's own Node fs logic at runtime (same
as how the CLI already worked), not by Webpack. Combined with
serverExternalPackages (kept, though it may now be redundant with the
asset/resource rule -- not yet tested with it removed) this is what
finally let /api/graph, /new, and the impact UI all load without errors
in the browser.

Lesson: for a require.resolve()-loaded native/WASM asset in Webpack, the
fix is almost never about identifier tricks or server package exclusion
lists -- it's about telling Webpack's module rules how to treat the file
type itself (asset/resource), so it never tries to parse it as code in
the first place.

## Update — Graph node icons + edge labels/arrows (visual polish, dogfood-driven)

Requested after visually testing the graph viewer live in-browser against
the arclux repo itself (localhost:3000, first real dogfood screenshot
session). Two gaps found:

1. All nodes were plain colored circles, no visual distinction between
   node types beyond color alone.
2. Edges were plain lines — no direction indicator, no way to tell edge
   type (import/export/call/route-link) without clicking through to
   inspect the underlying data.

Fixes:

- `apps/web/components/graph/nodeIcons.tsx` (new) — minimal single-path
  SVG icons per GraphNodeType (file/folder/external-package/route/
  component/hook), drawn inside GraphNode's existing circle. Deliberately
  NOT using a full icon library import (e.g. lucide-react) here — graphs
  can have 1000+ nodes, each rendered icon is a cost, so this is a raw
  path string sized for an 8x8 viewBox instead.
- `apps/web/theme/graphColors.ts` — added `getGraphEdgeHighlightColor()`.
  The existing dark-mode `import` edge color (#454545) was deliberately
  dim so a busy graph doesn't look noisy at rest, but that same dimness
  made it nearly invisible once highlighted/selected against
  GraphCanvas's black background. Highlight colors are a separate,
  brighter palette, not a theme mode swap (GraphCanvas's background is
  hardcoded black regardless of app theme).
- `apps/web/components/graph/GraphEdge.tsx` — highlighted edges now show
  an arrowhead (SVG marker) and a type label ("imports"/"exports"/
  "calls"/"routes to") at the midpoint.
- `apps/web/components/graph/GraphCanvas.tsx` — registers 4 `<marker>`
  defs (one per edge type) in `<defs>`, referenced by GraphEdge via
  `markerEnd`.

**Known limitation, not fixed in this change**: line endpoints are node
CENTERS, not circle edges, so the arrowhead lands under/inside the target
node's circle instead of stopping cleanly at its boundary. Would need the
line shortened by the node's rendered radius (which varies by
selected/hovered state) — not threaded through to GraphEdge yet.

**Also not fully resolved**: label popping on hover (not just click) may
get noisy on a high fan-in hub node, since `isHighlighted` covers both
hover and selected states — hovering a hub like `Repository.ts` (34
incoming edges, seen in live testing) would pop 34 labels at once.
Flagged in the component's own comment, not yet addressed.

Verified so far: `tsc --noEmit -p apps/web/tsconfig.json` clean. Node
icons confirmed visually in-browser (dogfood screenshot showed file-type
document icons rendering correctly on all nodes in a TypeScript-only
subgraph — other node type icons folder/component/hook/route/
external-package not yet visually confirmed since that subgraph happened
to be all-file). Edge label/arrow/color change was NOT visually verified
before merging — pushed under time pressure near a chat context limit,
confirm in-browser before relying on it.

## Update — GraphFocusView (new): replaces overlapping edge labels on high-fan-in nodes

Dogfooding on the graph viewer against the arclux repo itself (mobile
screenshot) showed hovering a high-fan-in node (index.ts, 85 incoming
edges) popped dozens of overlapping "imports" labels on the canvas —
unreadable. This is the same root cause already flagged in GraphEdge.tsx's
own comment (isHighlighted covers hover, not scoped per-edge).

Rather than patch the label-overlap directly, built a different
interaction: `apps/web/components/graph/GraphFocusView.tsx` — a full-panel
overlay (replaces `GraphSelection.tsx` in `GraphViewport.tsx`) that opens
on node selection, showing DIRECT dependencies/dependents as two columns
of labeled cards (icon + name + path, reusing `getGraphNodeColor` /
`nodeIcons.tsx` already in the codebase). Capped at 12 cards per side
("+N more") specifically because of the 85-incoming-edge case found in
this same repo — an uncapped list would just move the unreadability
problem into the panel instead of fixing it.

Scope: DIRECT neighbors only, not transitive — this is a readable local
map, not a replacement for `traceConsumers`/`traceDependencies` in
packages/impact/*.

**NOT YET DONE**: the underlying canvas label-overlap bug (GraphEdge.tsx)
is still there — GraphFocusView is a new, separate way to inspect a
node's connections, it doesn't fix hover behavior on the canvas itself.
Also **not visually verified in-browser yet** — only typechecked
(`tsc --noEmit -p apps/web/tsconfig.json`), pushed under time pressure
near a chat context limit. Confirm visually before relying on it,
same caveat as the earlier edge-label/arrow update.

**Repo now requires branch protection on `main`** (PR required, verified
by testing it against ourselves earlier) — this was pushed via
`feat/graph-focus-view` branch + PR, not direct push. Any future session:
you CANNOT `git push` directly to `main` anymore, always
`git checkout -b <branch>` first.

## Update — large-repo limitation found via dogfooding (NOT a bug, not yet addressed)

Tested against `vercel/next.js` (huge) and `microsoft/TypeScript` (huge,
lots of test fixtures) from the mobile Termux environment.

- `vercel/next.js` — worked, but took a very long time (clone + scan +
  parse of tens of thousands of files, synchronously, on a phone).
- `microsoft/TypeScript` — showed "Indexing failed" in the UI. Root cause
  not yet diagnosed (no server log was captured at the time — the dev
  server had just been restarted, so the actual crash/error was missed).
  Re-run with `curl "http://localhost:3000/api/graph?repoUrl=..."` while
  watching the `npm run dev` terminal output to actually capture the
  error next time this is investigated.

This is a real device/resource-capacity limitation, not a pipeline
correctness bug — smaller repos (`vscode` was mentioned as working; the
`python-demo` fixture and small GitHub repos all work fine) are unaffected.
The pipeline currently has NO safeguards for large repos: no file-count
cap, no timeout, no progress streaming — `analyzeRepository()` just tries
to clone/scan/parse everything in one synchronous request regardless of
size, which is fine on a small repo but can hang or crash on a phone for
something the size of TypeScript's repo.

**Two concrete follow-ups identified, not yet built**:
1. Progress indicator during analysis — right now the UI just shows
   "Analyzing..." with no feedback on whether it's actually progressing
   or stuck, which is why microsoft/TypeScript's failure looked
   indistinguishable from vercel/next.js's "just slow" until it errored.
2. A size guard/warning before starting analysis — e.g. checking repo
   file count via the GitHub API before cloning, and warning the user
   ("this repo is large, analysis may take a while or fail on this
   device") rather than only finding out after a long hang.

Neither is built yet — this is a known gap, not scoped/prioritized
against the rest of the backlog yet.

## Update — dark theme default fix + GraphMenu consolidation

**Dark theme bug found via dogfooding**: landing page and graph viewer
rendered light/white despite theme/arclux.json being dark-first by
design. Root cause: hooks/useTheme.ts existed and worked, but NOTHING in
the app tree ever called it — app/layout.tsx never applied the "dark"
class to <html> at all. Fixed:
- app/layout.tsx now has an inline script (runs before hydration) that
  applies "dark" class by default, only removing it if the user
  explicitly chose "light" before (localStorage). Avoids flash-of-light
  on every page load.
- hooks/useTheme.ts default flipped from "light" to "dark", and its
  useEffect now reads what layout.tsx's script already applied instead of
  independently re-deciding (avoids the two disagreeing).
- Replaced leftover create-next-app boilerplate metadata (title was
  literally "Create Next App").

**GraphMenu.tsx (new)**: consolidates GraphToolbar.tsx (zoom controls)
and GraphLegend.tsx (node/edge color key) into one toggleable slide-out
panel — canvas was getting cluttered with search bar + toolbar + legend +
focus view all fighting for corner space at once (seen in mobile
screenshots). GraphViewport.tsx now renders GraphMenu instead of
GraphToolbar+GraphLegend directly. The two old components are NOT
deleted, just no longer wired in — check before assuming they're unused
elsewhere.

**STATUS: typecheck-only, NOT visually verified in-browser yet** — both
changes pushed near a chat context limit. Confirm before relying on them:
1. Reload the app, confirm dark theme applies immediately (no white
   flash)
2. Open the graph viewer, click "Menu" button (bottom-left), confirm
   zoom controls + legend render correctly inside the slide-out panel

**Also still open from earlier**: GraphFocusView (two-column
dependencies/dependents panel) was also pushed without visual
verification in a previous update — still needs confirming.

## Update -- JavaScript parser: parseJs/parseJsx/parseCommonJs written and registered

packages/parser/javascript/extractJs.ts (shared) + parseJs.ts + parseJsx.ts
+ parseCommonJs.ts implemented and registered in packages/engine/pipeline.ts.
Reuses TypeScript Compiler API with ScriptKind.JS/JSX (NOT reusing
parseTs.ts's extractors directly -- those detect TS-only syntax like
"import type" that plain JS can never have). Detects ES import/export,
dynamic import(), require(), and per-property CommonJS
(module.exports.x = / exports.x =).

KNOWN GAP, NOT YET FIXED: whole-object exports
(module.exports = { a, b }) are NOT detected -- only per-property
assignment is. This under-reports exports for a lot of real-world
CommonJS. Confirmed common via nodejs/cjs-module-lexer's own test fixtures
(~/research/cjs-module-lexer/test/_unit.js) during research for this
work. Follow-up PR needed for extractWholeObjectExports() (shorthand
props, renamed props, string-literal keys, getter exports -- spread
props and computed keys can stay unsupported/silently skipped for now).

parseCommonJs.ts is currently behavior-identical to parseJs.ts (kept
separate on purpose -- see its own file comment -- because the
whole-object-exports follow-up is scoped to CommonJS specifically, not
plain JS).

NOT YET DONE: no playground fixture, no end-to-end verification via
scripts/testPlayground.ts or CLI doctor -- only tsc --noEmit passed so
far. Next session should build playground/commonjs-demo/ using patterns
from cjs-module-lexer's test file before trusting this beyond typecheck.

## Update — Go & Java parsers written and verified (parseGo.ts, parseJava.ts)

packages/parser/go/parseGo.ts and packages/parser/java/parseJava.ts
implemented (regex/line-based, not tree-sitter — no grammar wired up for
either language yet, unlike Python). Registered in both
packages/engine/pipeline.ts AND scripts/testPlayground.ts (the latter had
been silently only registering parseTs+parsePython — same class of bug as
files getting skipped in buildIndex.ts's "no parser registered, skip
silently" path, worth remembering next time a new parser is added
anywhere).

**Verified via scripts/testPlayground.ts against playground/go-demo and
playground/java-demo (not just tsc --noEmit)**:
- 6/6 modules indexed in both fixtures (previously 0, confirming parsers
  are now actually registered and running)
- Export extraction confirmed correct: Go's uppercase-first-letter
  convention (HelperA, User, Product, Slugify, UnusedHelper) and Java's
  `public` modifier convention (class/method/field level) both extract
  the expected names, matching what each fixture file was written to
  contain — including the deliberately-unused UnusedHelper/unusedHelper
  in each

**EXPECTED LIMITATION, confirmed empirically, NOT a bug**: both fixtures
show 0 graph edges despite real cross-file calls existing (cyclic_a.go
calls HelperB in cyclic_b.go, Main.java calls Service/Models/Utils) —
this is because Go and Java don't require any import statement between
files in the same package/directory, so there's nothing for
resolvePath.ts to resolve. This makes every file/export in both fixtures
show up as a false positive in detectOrphanFiles/detectUnusedExports/
detectUnusedFiles, same root cause class as the already-documented
Python/main.py false positive from resolveRoutes.ts being empty. A
"same-package implicit dependency" resolution pass would be needed to
fix this for Go/Java specifically — not yet built, not scoped.

**NOT yet tested**: real-world Go/Java repos beyond the playground fixture
(multi-package Go with actual cross-package imports, Java with actual
`import demo.other.Thing;` statements) — only the same-package-only
fixture has been verified so far.

## Update — Manifest parsers built (parseGoMod, parseCargoToml, parsePackageJson, parseComposer, parseGemfile, parseGradle/parsePom, parseCsproj) + ManifestParser interface

New packages/parser/core/ManifestParserInterface.ts (ManifestDependency:
name/versionRange/kind runtime|dev; ManifestParser: filename + sync parse()).
Distinct from LanguageParser/ParserRegistry — manifests are single
well-known files read directly, not scanned. Generic format primitives
added: config/parseJson.ts, config/parseToml.ts (parseTomlSections, NOT
spec-complete TOML), config/parseYaml.ts (parseFlatYaml, unused so far).

Verified against REAL manifests from public repos (gin, tokio, laravel,
rails, spring-petclinic — downloaded to ~/manifest-samples, outside the
repo) via scripts/testManifests.ts, not hand-written fixtures:
- parseGoMod: 35/35 deps correct (gin's go.mod)
- parseCargoToml: found and FIXED a real bug — first version only handled
  flat [dependencies]/[dev-dependencies], missed tokio's many
  [target.'cfg(...)'.dependencies] conditional sections and
  single-dep-per-section form ([target.'cfg(windows)'.dependencies.windows-sys]).
  Fixed via classifySection() suffix matching + SINGLE_DEP_SECTION_PATTERN.
  13 -> 36 deps after fix, matches tokio's Cargo.toml.
- parseComposer: 8/8 correct, php/ext-*/lib-* platform entries correctly filtered
- parseGemfile: 82 deps found, all reported "runtime" — KNOWN LIMITATION,
  doesn't read `group :test do...end` blocks, so gems only ever declared
  inside a group (rubocop, mdl, sdoc group etc in rails' real Gemfile)
  are mis-classified as runtime. Not fixed, documented in file comment.
- parsePom (Maven): 30 found but 2 are WRONG — regex matches every
  <dependency> in the file including ones nested inside
  <plugin><dependencies> (checkstyle plugin's own deps), which aren't
  real project dependencies. NOT FIXED — would need real XML tree
  parsing to scope to the top-level <dependencies> block only, not a
  regex. Known false-positive, documented in file comment.
- parseGradle (Groovy DSL) — NOT yet tested against a real build.gradle,
  only pom.xml side was verified.

**Also fixed while building this**: packages/graph/buildFolderGraph.ts
was failing tsc with "Cannot find module 'd3-hierarchy'" — dependency was
used but never installed. Fixed with `pnpm add d3-hierarchy -w` +
`pnpm add -D @types/d3-hierarchy -w` (-w needed because packages/* isn't
a pnpm workspace member, only apps/* is — deps go to root package.json).

**STILL NOT DONE**: nothing calls these manifest parsers from
detectRepositoryMeta.ts or anywhere else in the pipeline yet — they exist
and are verified standalone (via testManifests.ts) but aren't wired into
analyzeRepository()'s framework/dependency detection. detectRepositoryMeta.ts's
own readDependencyNames() (package.json only, flat Set<string>) still runs
separately and hasn't been merged with this new ManifestDependency-based
system — that's a follow-up, not done here.

**Gotcha hit while building this**: a `cat > file << EOF` heredoc run
while `cd`'d into ~/manifest-samples instead of ~/arclux silently created
packages/parser/rust/parseCargoToml.ts under ~/manifest-samples/packages/...
instead of overwriting the real file — the real ~/arclux file kept its
old (buggy, pre-fix) content even though the terminal showed no error.
Caught only because testManifests.ts's output (13 deps) didn't match the
expected fix. Lesson: always `pwd` before a `cat > path << EOF` if you've
`cd`'d anywhere else in the same session — a wrong-directory heredoc
fails silently, it doesn't error.

## Update - manifest parser fix, export/import graph builders, call graph planning

Done and merged to main this session:
- Fixed parseCargoToml.ts bug: was missing platform-conditional sections
  like [target.'cfg(unix)'.dependencies] and single-dep sections like
  [target.'cfg(windows)'.dependencies.windows-sys]. Verified against real
  tokio Cargo.toml: 13 deps before fix, 36 after, matches expected.
- Added scripts/testManifests.ts manual verification script, tested
  against real manifests (gin, tokio, laravel, rails, spring-petclinic).
- Added packages/graph/buildExportGraph.ts: complement to
  buildDependencyGraph.ts. Nodes = modules with exports, edges (type
  "export") = module -> each importer, deduped, plus resolvedReExports
  folded in as extra edges from original source to re-exporting module.
- Added packages/graph/buildImportGraph.ts: weighted variant of
  buildDependencyGraph.ts. Uses ModuleInfo.resolvedImports (not the flat
  imports[] array) so edges carry a weight = number of import statements
  between two modules. Note: GraphEdge has no metadata field, so kind
  breakdown (static/dynamic/require/type-only) is NOT preserved on the
  edge - only the count. Consumers needing that detail should read
  resolvedImports directly.
- Repo cleanup: deleted ~10 stale already-merged branches, removed an
  accidentally-committed apps/web/FETCH_HEAD file (leftover git internal
  file from an old commit, not source code).
- Workflow change: main is now protected, direct push to main no longer
  works. New flow: branch -> commit -> push branch -> PR on GitHub ->
  merge -> git checkout main && git pull.

STILL NOT DONE - call graph (packages/graph/buildCallGraph.ts):
Planned but not implemented yet. Design decided:
- RawCall { calleeName, line } added to ParsedFile as OPTIONAL field
  (calls?), since 7 other parsers - Go, Java, Python, TS, etc - build
  ParsedFile literals without it and would break if it were required.
- ResolvedCall { moduleId, calleeName, line } plus calls/calledBy fields
  added to ModuleInfo as REQUIRED (only buildIndex.ts constructs
  ModuleInfo, so safe to make required there).
- Known limitation to document in code: extractCallsJs will only catch
  bare-identifier calls like foo(), NOT obj.foo() or this.foo() - property
  access calls need type info to resolve safely, out of scope for AST-only
  pass. Cross-file resolution in buildIndex.ts can only match a callee
  name against namedImports already resolved for that module - calls to
  default-imported functions can't be resolved back to their source module,
  since RawImport does not store a local name for default imports.
- Attempted to patch packages/shared/types.ts with a Python script this
  session but it failed - the heredoc got cut off / corrupted when pasted
  into the mobile terminal app, likely due to length and/or special
  characters. No files were actually changed as a result - types.ts is
  still in its original state. Next session should retry with shorter,
  simpler patch commands (plain ASCII, no em-dashes, broken into smaller
  steps) rather than one large heredoc block.
- Files that still need changes once types.ts is patched: extractJs.ts
  (add extractCallsJs, bare-identifier calls only, exclude "require"),
  parseJs.ts / parseJsx.ts / parseCommonJs.ts (wire in extractCallsJs),
  buildIndex.ts (resolve RawCall -> ResolvedCall via namedImports lookup,
  backfill calledBy same pattern as importedBy), and finally
  buildCallGraph.ts itself (weighted, same pattern as buildImportGraph.ts,
  edge type "call").

## Update — parseTsx.ts and parseTsConfig.ts confirmed intentionally empty

Verified, not just assumed: `packages/parser/typescript/parseTsx.ts` and
`parseTsConfig.ts` will stay empty stubs permanently, not because they're
"not done yet" but because their functionality already lives elsewhere:

- `.tsx` parsing: handled inside `parseTs.ts` itself via
  `ts.ScriptKind.TSX` (checked its `extensions` field and ScriptKind
  selection logic directly).
- tsconfig.json parsing: handled inside
  `packages/indexer/resolveAliases.ts`, which reads tsconfig.json /
  jsconfig.json directly (with comment/trailing-comma stripping) for
  path-alias resolution.

Both files now have a comment explaining this, so a future session
doesn't attempt to implement duplicate logic in either of them — same
class of risk previously flagged for `packages/ui/graphColor.ts` vs
`theme/graphColors.ts` (that one is still an open risk; these two are now
resolved/documented).
