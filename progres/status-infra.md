# ARCLUX Progress — Infra (CLI, collaborator tooling, testing, cleanup, dogfood)

See PROGRES.md for the index. Split by topic from the original PROGRES-status.md.

## 2026-08-03 — Update — First real end-to-end verification (playground/python-demo)

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

## 2026-08-03 — Update — apps/cli (5/6 files, index.ts now has real content)

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

## 2026-08-03 — Update — doctor.ts now calls 10/18 detectors (updated from 9/18)

`apps/cli/doctor.ts` updated to call the 5 new detectors above in addition
to the 5 previous ones. Still manual per-detector calls (no registry yet)
— the file's own comment already notes this is worth turning into a
registry once you hit detector #8+, because each detector has a different
finding shape (`cycle` vs `filePath`+`line` vs `hash`+`filePaths[]` vs
`isPureBarrel`), so a registry would need a print-adapter per detector,
not just a list of functions.

## 2026-08-04 — Update — Large sync from other parallel sessions (read before assuming anything is 0%)

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

## 2026-08-04 — Update — duplicate PROGRESS.md file (double-S typo) deleted

There was briefly a separate file named PROGRESS.md (not PROGRES.md) from
another session that typo'd the filename. It has been deleted —
PROGRES.md (single-S) remains the one official progress file.

## 2026-08-04 — Update — apps/cli/impact.ts confirmed to ALREADY be correct (no longer an open item)

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

## 2026-08-05 — Update — large-repo limitation found via dogfooding (NOT a bug, not yet addressed)

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

## 2026-08-05 — Update - shadcn re-exports fixed, real test suite started, 3 large-repo stress tests

**Fixed issue #3** (Re-export missing shadcn primitives): 5 files were
missing from apps/web/components/ui/ — avatar.tsx, badge.tsx,
checkbox.tsx, skeleton.tsx, switch.tsx. Added following the exact
1-line wrapper pattern already used by button.tsx etc
(`export * from "@/vendor-ui/shadcn/X"`), plus the matching export lines
in index.ts. Verified with `npx tsc --noEmit -p .` before/after — the 5
"Cannot find module" errors disappeared, no new errors introduced.
Merged via PR #52.

**Found while fixing #3, filed separately as issue #51 (not fixed yet)**:
apps/web/components/ui/input-group.tsx and
apps/web/vendor-ui/shadcn/input-group.tsx both fail to resolve @/ path
aliases (@/lib/utils, @/vendor-ui/shadcn/button, @/vendor-ui/shadcn/input,
@/vendor-ui/shadcn/textarea, and even input-group referencing itself).
Other files using the identical @/vendor-ui/shadcn/X pattern resolve
fine, so this looks isolated to input-group specifically, not a general
alias bug. Not yet investigated.

**Test suite started (issue #8), went from literal 0% to something real**:
No test framework existed before this — package.json's `"test": "turbo
run test"` script would have failed outright since no turbo.json exists
in the repo. Installed vitest (`pnpm add -D vitest -w`), added
vitest.config.ts pointing at tests/**/*.test.ts, changed the test script
to `vitest run`.

Wrote the first 2 real test files, both using REAL manifest files copied
into tests/fixtures/ (not hand-written fixtures) — same go.mod (gin) and
Cargo.toml (tokio) already verified manually via scripts/testManifests.ts
in an earlier session, now made permanent and automatic instead of
eyeballed:
- tests/parser/go.test.ts — 4 tests against parseGoMod, checks the full
  35-dependency count, confirms every dep is kind "runtime" (Go has no
  dev-dependency concept), checks one known dependency's exact version
  string, and checks the empty-input case.
- tests/parser/rust.test.ts — 4 tests against parseCargoToml, checks the
  full 36-dependency count, checks the 16 runtime / 20 dev split, and
  specifically checks that windows-sys resolves from BOTH a runtime
  cfg(windows) section and a dev-dependencies cfg(windows) section — this
  is a regression guard for the exact platform-conditional-section bug
  that was fixed earlier (13 -> 36 deps after the fix).

**STILL NOT DONE**: the other 9 test files (pipeline, graph, impact,
indexer, detector, parser/java, parser/python, parser/rust... wait rust
is done — parser/javascript, parser/typescript) are still empty
placeholders (0 lines, not even a license header — below the 8-line
baseline). Merged via PR #57.

**Stress-tested ARCLUX against 3 large real-world repos by cloning them
locally and running the pipeline** (not automated, done manually via the
web UI): microsoft/vscode, facebook/react, vercel/next.js. All 3
completed without crashing — graph rendering, impact analysis ("this file
needs N / affects M"), and the physics-based d3-force layout all worked
correctly at scale (VSCode alone is hundreds of thousands of lines across
a complex monorepo). No new bugs surfaced from these three specifically,
but they haven't been used to generate automated test fixtures yet — that
would be a good follow-up (same pattern as the go.mod/Cargo.toml fixtures
above, but for TS/JS at a much larger scale).

**New issues filed and assigned to new collaborators this session**:
- #50 (assigned: xcontcom) — implement packages/graph/buildCallGraph.ts.
  Design was already finalized in an earlier session (see decisions.md
  if that's been migrated, or check git history of this file pre-split):
  RawCall/ResolvedCall types, extractCallsJs bare-identifier-only
  limitation, buildIndex.ts resolution via namedImports lookup. Not
  started as of this writing — packages/graph/buildCallGraph.ts is still
  the 8-line license-header-only stub, packages/shared/types.ts has zero
  occurrences of RawCall/ResolvedCall.
- #53 (assigned: Alitindrawan24) — new Laravel convention detector,
  requireController (route -> controller existence check), modeled after
  packages/rules/nextjs/requirePage.ts. Scoped deliberately small for v1:
  only the `[UserController::class, 'index']` array-callable syntax,
  explicitly skipping closures and the old `'UserController@index'`
  string syntax as a documented limitation rather than trying to handle
  every route syntax at once.

## 2026-08-05 — Update - checkCollaboratorMarkers.ts script added

Built scripts/checkCollaboratorMarkers.ts to enforce the "mark
collaborator-assigned files in-file" decision from the previous
session. Reads open, assigned GitHub issues via `gh issue list`,
extracts file paths mentioned in each issue body, and checks whether
that file's content actually references the issue number.

Detection only, not auto-write — a good marker comment needs context
(why deferred, actual scope) that a script can't meaningfully generate.
Run it, then write the comment by hand for anything it flags.

Known limitation confirmed during first real run: can't distinguish
"file the assignee must create/modify" from "file mentioned only as a
reference pattern to read first" - issue #53 telling Alitindrawan24 to
read packages/rules/nextjs/requirePage.ts as an example produced a
false-positive flag on that file. Documented in the script's own
comment. Treat output as a starting point for manual review, not an
authoritative list.

First real run also correctly flagged packages/shared/types.ts and
packages/parser/javascript/extractJs.ts (issue #50, xcontcom) as
missing markers - left unmarked deliberately for now, since xcontcom
hasn't started work on either file yet (confirmed: grep for
RawCall/ResolvedCall in types.ts still returns 0 matches). Marking
should happen once actual work begins there, not preemptively.

Also this session: added progres/collaborators.md (new
category file tracking who's assigned to what) and updated PROGRES.md's
index to include it - both the read-all-files cat command and the
"where does my update go" decision guide now cover 5 categories, not 4.
Merged via PR #72 (collaborators file) and #73 (marker script).

## 2026-08-06 — Update - collaborator marker system self-tested, bug found and fixed

Ran a real end-to-end self-test of the collaborator marking system
built last session (collaborators.md + checkCollaboratorMarkers.ts):
filed issue #75 (scripts/benchmark.ts, assigned to GSF-001 as a test
subject), ran the detection script, added the marker comment, ran again
to confirm it disappeared from the missing-marker list. Full loop
confirmed working.

Found a real bug during this test: checkCollaboratorMarkers.ts only
scanned an issue's body for file paths, not its title. Issue #75's
first draft mentioned scripts/benchmark.ts only in the title, and the
script silently missed it. Fixed by scanning title + body together.
Confirmed this wasn't just a test-issue artifact — the fix also caught
a real miss, packages/graph/buildCallGraph.ts (issue #50), which was
being missed for the identical reason before the fix. Merged via #76.

Also added scripts/README.md — a table explaining what every script in
scripts/ does and its current status (working / not started), so
"what does this do" doesn't need re-investigating each time. Covers
testManifests.ts, testPlayground.ts, checkCollaboratorMarkers.ts
(all working) and build.ts, benchmark.ts, generateFixtures.ts,
release.ts (all not started / unclear purpose, noted honestly rather
than guessed at). Merged via #77.

Confirmed packages/rules/nextjs/requirePage.ts continues to correctly
show up as a false-positive in checkCollaboratorMarkers.ts output
(known/documented limitation - it's referenced in issue #53 only as an
example pattern to read, not Alitindrawan24's actual task file). Left
unmarked on purpose, this is expected script behavior, not a bug.

## 2026-08-06 — Update - packages/README.md added

Per-folder status table generated from an actual file scan (line-count
stub detection), not memory. Snapshot: repository/detectors/impact/
incremental/shared/parser/graph = working, watcher/indexer/git/engine =
partial, search/rules/cache/db/ui = stub. Also flagged: an incremental/
folder exists (6 files, fully done) that wasn't tracked in earlier
PROGRES.md entries - appears to have been built in a session not
reflected in this doc's history. Re-run the scan command in
packages/README.md periodically to keep it current; don't hand-edit the
table without re-running it first.


## 2026-08-06 — PROGRES-status.md split into 5 topic files

`progres/PROGRES-status.md` (1257 lines, single file) split into:
`status-core.md`, `status-detectors.md`,
`status-web.md`, `status-infra.md`,
`status-backlog.md`. Split by line-range mapping, verified via
line-count assertion before writing (no gaps/overlaps). Old file deleted.
Root `PROGRES.md` index updated to reference the 5 new files in both the
preamble `cat` command and the "quick decision guide" section (previously
still pointed at the deleted `status.md`).

## 2026-08-06 — log-progress.sh helper script added

Created scripts/log-progress.sh: appends a dated ## YYYY-MM-DD — title entry to the correct progres/PROGRES-*.md file automatically, using the local device date. Usage: scripts/log-progress.sh <category> "title" "body". Removes the need to hand-type date headers.

## 2026-08-06 — Repo config tooling added

Added .github/PULL_REQUEST_TEMPLATE.md, .github/CODEOWNERS (verified against actual GitHub collaborator list via gh api repos/.../collaborators, not guessed), .gitmessage (commit message template), .githooks/pre-commit (blocks commits that add an undated header to progres/PROGRES-*.md), .editorconfig, .github/workflows/ci.yml (typecheck/lint/test on PR), and merged new sections into the existing CONTRIBUTING.md rather than overwriting it.

## 2026-08-08 — progres/PROGRES-*.md files renamed, drop redundant prefix

**Status:** Done

progres/PROGRES-bugs.md etc renamed to progres/bugs.md etc (folder name already gives context, prefix was redundant). Updated all references across PROGRES.md, README.md, TOOLING.md, QUICKSTART.md, progres/README.md, and scripts/log-progress.sh (which builds the filename dynamically from category).

 main
## 2026-08-13 — Editor and diagnostics layers implemented, pending merge

**Status:** In Progress

Implemented packages/editor/ (CodeNavigator, ImpactNavigator, SymbolProvider, LineContext, EditContext) and packages/diagnostics/ (ErrorLocation, DiagnosticEngine wrapping 3 detector adapters -- circularDependency, deadCode, ambiguousSymbolResolution -- ErrorContext, DiagnosticEvent, FixSuggestion). Wired into CLI via apps/cli/diagnose.ts, registered in apps/cli/index.ts. Verified working end-to-end with 'npx tsx apps/cli/index.ts diagnose .' (62 real findings against this repo itself). All detector adapters call real functions from packages/detectors/* and packages/impact/* -- no reimplementation, no mocked data. Two things still open: (1) branch 'feat/diagnostics-layer' has all of this work but is NOT YET MERGED to main as of this entry -- verify before assuming it's live. (2) FixSuggestion.ts only covers the 3 wired checkIds; other 15 detectors not yet wired into diagnostics/ -- read each detector's actual return shape before adding, they are NOT uniform (confirmed: circularDependency has no line info, deadCode has file but no line, ambiguousSymbolResolution has real line info per definition).

 docs/log-today-progress-v2
## 2026-08-13 — Platform layer docs map lengkap

**Status:** Done

docs-site/map/map-packages-platform.mdx sekarang punya tabel tanggung jawab tiap file, section Blueprint Integration yang memetakan alur editor dan semantic-diff pipeline ke file konkret plus dependency ke packages/engine, parser, diff, impact yang sudah ada, diagram arah dependency satu arah, dan daftar file existing yang perlu diedit nanti (apps/cli/index.ts, apps/web/lib/api.ts). Status: dokumentasi selesai, logic belum diisi.

## 2026-08-13 — Platform layer docs map lengkap

**Status:** Done

docs-site/map/map-packages-platform.mdx sekarang punya tabel tanggung jawab tiap file, section Blueprint Integration yang memetakan alur editor dan semantic-diff pipeline ke file konkret plus dependency ke packages/engine, parser, diff, impact yang sudah ada, diagram arah dependency satu arah, dan daftar file existing yang perlu diedit nanti (apps/cli/index.ts, apps/web/lib/api.ts). Status: dokumentasi selesai, logic belum diisi.

## 2026-08-13 — Platform layer docs map complete

`docs-site/map/map-packages-platform.mdx` sekarang punya: (1) tabel
tanggung jawab tiap file per package platform layer, (2) section
"Blueprint Integration" yang memetakan alur editor dan semantic-diff
pipeline ke file konkret + dependency existing engine, (3) diagram arah
dependency satu arah (Developer Layer → Platform Layer → ARCLUX Engine),
(4) daftar file existing yang perlu diedit nanti (`apps/cli/index.ts`
buat register command baru, cek `apps/web/lib/api.ts` buat shared
middleware). Status: dokumentasi selesai, implementasi logic belum
dimulai.
ARCLUX.main

## 2026-08-13 — Dogfood ARCLUX on Django

**Status:** scripts/log-progress.sh

Stress-tested ARCLUX on the Django repository: 3,039 modules and 7,734 dependency edges analyzed in ~30s on Termux/Android. Impact analysis traced django/db/models/lookups.py to 1,319 affected files. Diagnostic analysis reached the current Node.js heap limit (~1 GB) after ~50s, establishing a real-world stress boundary.

## 2026-08-13 — Django stress test

**Status:** Not Started

ARCLUX indexed 3039 modules and 7734 dependency edges in ~30s; impact traced django/db/models/lookups.py to 1319 affected files; diagnose reached Node heap limit on Termux.
