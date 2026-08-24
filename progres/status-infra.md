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

> **[STATUS UPDATE, 2026-08-14]: this entry is resolved — analyzeLocal.ts
> was merged into pipeline.ts on 2026-08-11 (LAB 3, see decisions.md).
> `analyzeRepository({ localPath })` is now the one entry point. The
> stale import left behind in packages/watcher/watchRepository.ts was
> fixed in this session (now calls `analyzeRepository({ localPath })`).**

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

> **[STATUS UPDATE, 2026-08-13]: `rules/` is no longer a stub** — all 10
> remaining rule files implemented and wired (see status-backlog.md's
> 2026-08-13 UPDATE entry). The scan below reflects the state as of 2026-08-06.

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

main
## 2026-08-14 — Scheduler package implemented and wired into ProcessManager

**Status:** Done

Implemented packages/scheduler/ (JobState, Job, JobQueue, JobScheduler) from scratch -- was a 4-file empty scaffold (11 lines each, license header only). Design pattern taken from Linux kernel kernel/workqueue.c + include/linux/workqueue.h: max_active (concurrency cap), WQ_HIGHPRI-style priority queue jump, delayed_work-style notBefore scheduling, ordered-mode strict FIFO. CPU-affinity/NUMA pool concepts from the same kernel file deliberately not ported -- not applicable to a single-process Node scheduler. Wired into packages/runtime/ProcessManager.ts's crash-restart path: previously a crashed process restarted instantly (this.start(spec) called directly in the exit handler), now goes through JobScheduler with exponential backoff (1s, 2s, 4s... capped 30s) keyed to the process's restart count, preventing crash-loop busy-restarting. Verified with tsc --noEmit -p apps/cli/tsconfig.json, no errors.

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

**Status:** done

ARCLUX indexed 3039 modules and 7734 dependency edges in ~30s; impact traced django/db/models/lookups.py to 1319 affected files; diagnose reached Node heap limit on Termux.
ARCLUX.main

## 2026-08-14 — Storage recovery layer: write-ahead journal for crash-safe writes

**Status:** Done

Implemented packages/storage/RecoveryManager.ts (was an 11-line stub) as a real write-ahead log, porting Linux jbd2's transaction state machine (T_RUNNING -> T_LOCKED -> T_FLUSH -> T_COMMIT -> T_FINISHED verbatim, minus disk-block-specific commit sub-phases which don't apply to whole-file JSON writes). writeTransactional() logs the payload to a journal BEFORE the real file write; once COMMIT is logged the transaction is durable even if the real write hasn't happened yet. recoverFromJournal() replays on startup: COMMIT-but-not-FINISHED transactions are REDONE from the journaled payload, transactions that never reached COMMIT are DISCARDED untouched. Wired into packages/storage/SnapshotManager.ts's writeProcessRecord (previously a plain fs.writeFileSync that could leave half-written records for readLiveProcessRecords to silently delete on read -- data loss). Wired recoverFromJournal() into packages/runtime/RuntimeManager's constructor so replay happens once at ARCLUX startup, before any process management begins.

## 2026-08-14 — Removed duplicate diagnose.ts stub

**Status:** Done

apps/cli/commands/diagnose.ts was an 11-line unregistered stub, duplicate name of the real apps/cli/diagnose.ts (which is registered and does the actual work). Kept edit.ts, open.ts, logs.ts, proc.ts, recover.ts (backing packages already have real logic, just not wired to CLI yet) and env.ts, service.ts, workspace.ts (backing packages still stubs too, nothing to wire yet).

## 2026-08-14 — Full daemon roadmap implemented: Phase 1-5

**Status:** Verified (build + daemon e2e, see below; only VS Code F5 manual test pending)

Completed all 5 phases of the 'ARCLUX as always-on service' roadmap in one session: (1) packages/daemon/ArcluxDaemon.ts -- push-based re-analysis via DaemonRepositoryWatcher wrapping watchRepository.ts, wired to Kernel's SignalBus, runs diagnostics automatically. (2) packages/daemon/LocalBridgeServer.ts -- HTTP+SSE bridge (GET /analysis, GET /events) so any editor/terminal can connect without a custom protocol, plus packages/networking/PortManager.ts + ServiceEndpoint.ts for port allocation and cross-process discovery. (3) packages/environment/EnvironmentDetector.ts -- walks up from cwd to nearest .git, so 'arclux daemon' works from any subfolder. (4) packages/daemon/DaemonProcess.ts -- --detach/--stop/--status flags, real background process via detached spawn + unref (PM2 pattern). (5) apps/vscode-extension/ -- minimal VS Code extension (status bar + Problems panel via daemon SSE). CAVEAT RESOLVED: verified 2026-08-14 -- 'pnpm install --filter arclux-vscode && pnpm --filter arclux-vscode build' pass (tsc strict, 0 errors, dist/ generated; only missing dep was @types/vscode). Daemon e2e ALSO verified against this repo: 'arclux daemon --detach' started a real background process (pid + log + endpoint file at ~/.arclux/endpoints/<id>.json), GET /analysis returned {moduleCount:565, meta}, GET /diagnostics returned 20 findings, GET /events delivered ': connected' + 'analysis' + 'diagnostics' SSE events triggered by a real file change. Remaining: manual test in VS Code's Extension Development Host (F5).

## 2026-08-15 — CLI diagnose: clickable file links via OSC 8

**Status:** Done

arclux diagnose output now wraps file paths in OSC 8 hyperlink escape sequences -- tappable/clickable in supporting terminals (Termux, iTerm2, VS Code integrated terminal), silent fallback to plain text elsewhere. Brings CLI to parity with the web Explorer's inline gutter markers (PR #389/#391) -- both surfaces now show file+line+message+suggestion, just via different interaction models suited to their medium (terminal list vs clickable gutter). See PR #397.

## 2026-08-15 — daemon --health flag

**Status:** done

Added getDaemonHealth check to daemon status CLI, verifies bridge server reachability alongside process status. PR #420 opened to ARCLUX.main.

## 2026-08-15 — getDaemonHealth merged, duplicate definition found+fixed

**Status:** Done

getDaemonHealth() added to DaemonProcess.ts (bridge reachability check via HTTP GET /analysis, port read from ServiceEndpoint.ts). apps/cli/daemon.ts --health flag already existed from a parallel session's earlier merge. Merge caused an accidental duplicate function definition (same code pasted twice, back to back) — caught by tsc TS2393 duplicate implementation error before commit, removed the dup. Lesson: after a git pull fast-forwards in changes from another session, diff the file you're about to patch before assuming your patch target still matches what you last saw.

 docs/log-session-progress
## 2026-08-15 — Docs site migrated Docusaurus → Mintlify

**Status:** Done

docs-site/ rebuilt from scratch on Mintlify instead of Docusaurus (matches
the framework code.claude.com/docs actually uses — Docusaurus was the wrong
target for visual parity). mint.json config with dark-mode locked
(modeToggle.isHidden), colors matching ARCLUX's own design tokens
(primary #0070F3, background #000000, from apps/web design-tokens colors.ts).
Content generator (scripts/generate-docs-mintlify.js) reads README.md,
PROGRES.md, ARCHITECTURE_MAP.md, TOOLING.md, CONTEXT.md, QUICKSTART.md
directly and regenerates .mdx pages on demand — rerun after any repo change,
no manual doc rewriting needed. MDX-safe sanitization added (bulldozer
angle-bracket escaping) after repeated build failures from placeholder text
like `<old title>` being parsed as JSX.
Known Termux-specific gotcha: `sharp` has no android-arm64 binary, needs
`npm install --cpu=wasm32 sharp` + `@img/sharp-wasm32` fallback for
`mintlify dev` to run — not yet fully verified working end-to-end.

## 2026-08-15 — Docs site migrated Docusaurus to Mintlify

**Status:** In Progress

docs-site/ rebuilt on Mintlify instead of Docusaurus. mint.json config with dark-mode locked, colors matching ARCLUX design tokens. Content generator reads README/PROGRES/ARCHITECTURE_MAP/TOOLING/CONTEXT/QUICKSTART directly and regenerates .mdx on demand. Known Termux gotcha: sharp needs wasm32 fallback for mintlify dev.
ARCLUX.main

## 2026-08-16 — CLI: arclux security command (phase 6)

**Status:** Done

New CLI command apps/cli/security.ts: runs secrets + unsafe patterns + data-flow + trust boundary + cross-boundary detectors and the attack-surface map, prints summary or --json/--sarif report; exit 1 on critical/high findings (--no-fail to override). Wired into apps/cli/index.ts. Verified on playground/nextjs-demo (0 findings, 4 reachable/2 unreachable = experiment match) and tests/fixtures/security-leaks (findings + valid SARIF).

## 2026-08-18 — Shell: interactive session (PR #514)

**Status:** Done

`arclux shell` interactive REPL (apps/cli/shell.ts + packages/shell/ArcluxShell.ts + plugins.ts). node:repl with custom eval + promise chain for piped stdin (`echo "analyze ~/flask" | arclux shell`). Commands: analyze/impact/deps/consumers/graph/doctor/search/plugins/run/watch/system/processes/services/exit/help. `~` expanded to $HOME (Termux has no /tmp). Analyzed repo stays in memory so impact/doctor/search/graph are O(1)-ish. Merged into ARCLUX.main.

## 2026-08-18 — Shell: watch on/off (PR #515)

**Status:** Done

`watch on|off` in the shell wraps watchRepository + chokidar with `ignoreInitial: true`. Prompt changes to `flask*>`. Known race: initial scan emits watch events during the first analyze — chokidar's ready event ordering; mitigate with a debounce window. Verified standalone via tests + manual run on ~/flask.

## 2026-08-18 — Shell: platform layer (PR #516)

**Status:** Done

User-space detectors (`~/.arclux/detectors/*.ts` → runDoctor extraDetectors, 19 built-in + N user), ShellSession (workspace + environment + processes + services, session.ts), RepositoryQuery (query.ts), plugin args (ctx.args). Doctor report shows built-in vs user detector counts. Merged into ARCLUX.main.

## 2026-08-19 — Boundaries package (PR #517)

**Status:** Done

Filled the boundaries stub package (was 9-line placeholder) with 4 real policies + index.ts:

- **SourceBoundaryPolicy** — classify (local / remote-git / unknown), allowedRoots/denyRoots, symlink containment (only when the textual path is inside an allowed root — avoids double-reporting). Roots realpath'd in constructor because Termux `/tmp` is a symlink.
- **RemoteAccessPolicy** — SSRF guard: blocks 10/8, 127/8, 169.254.x.x metadata, 172.16/12, 192.168/16, 0/8, ≥224, IPv6 loopback/link-local/ULA. Protocol + host allowlists, maxUrlLength 2048. IPv6 brackets stripped before isIP() — URL.hostname keeps `[::1]` brackets.
- **AnalysisBoundary** — hard caps: maxFiles 100k / maxBytes 2GiB / maxModules 100k; denied path segments node_modules/.git/vendor + extra.
- **EvidenceBoundary** — redact() secrets (api key, token/secret/password with `["'\s:=]+` separator, bearer, gh[pousr]_, AKIA, private keys, connection strings) + cap() per-check limits + message length trim.
- index.ts exports all four; zero new runtime deps.

Wired into real consumers (no dead code):
- `analyzeRemoteSource` (packages/remote-analysis/analyzeRemoteSource.ts) — SSRF assert on `source.url` before anything else.
- Shell `analyze` — appends `Boundary:` violation lines from SourceBoundaryPolicy + AnalysisBoundary.
- Shell `doctor` — EvidenceBoundary({maxFindingsPerCheck: 20}) redact+cap with `(capped)` marker.

Verified end-to-end on ~/flask: analyze clean (0 violations, permissive defaults), doctor shows `circularDependency: 20 (capped)`, SSRF guard blocks `http://169.254.169.254/latest/meta-data/` and `http://[::1]/x.git` while `https://github.com/...` passes. 16 new tests in tests/boundaries.test.ts → suite 625→641.

Gotchas learned: SCP-style `git@github.com:foo/bar.git` is NOT a URL (use ssh://); "token is sk_..." regex never matches (is is a word, not a value — use `token=sk_...`); private-key pattern needs the `-----` fence; `/etc` on Termux is a symlink (use a second tmpdir in tests).

Infra note: vitest 4's rolldown bundler has no native Termux binary — needs `@rolldown/binding-wasm32-wasi` + emnapi runtime. On this machine: `pnpm install --force` restored the working tree; NAPI_RS_NATIVE_LIBRARY_PATH / NAPI_RS_FORCE_WASI are the escape hatches.

## 2026-08-20 — Source adapters: packages/adapters filled (PR #520)

**Status:** Done

Four stub files replaced with real routing logic + index.ts:
- `LocalSourceAdapter` — local path/`file://` (with `~` → $HOME expansion), realpath + exists checks.
- `GitHubSourceAdapter` / `GitLabSourceAdapter` — https, ssh://, and SCP-style (`git@host:org/repo.git` → ssh://) forms; gitlab covers gitlab.com + self-hosted.
- `ArchiveSourceAdapter` — .zip/.tar.gz/.tgz files (streams + checksum validation; no zip-slip: extracts under a created root).
- `RemoteHostAdapter` — fallback for ANY public host that speaks git, with port/path parsing — mirrors the confirmed intent that arclux must work with all public https hosts, not just github.
- index.ts: `createSourceAdapter()` (explicit type or scheme sniffing) + `adaptSource()` (returns AdapterResult, null for unsupported).

Wired into real consumers: `analyzeRemoteRequest` (analyzeRemoteSource.ts) uses `adaptSource()` before URL acquisition; `apps/cli/security.ts` uses `createSourceAdapter`. Verified 8 routing cases (github https/ssh/scp, gitlab variants, archive, local, remote fallback) + SSRF metadata still blocked. No scaffold markers left.

## 2026-08-20 — Daemon /impact endpoint + hardened VS Code extension (PR #522)

**Status:** Done

- Daemon: new `GET /impact?file=` (ArcluxDaemon.getImpact → calculateAffectedFiles; 404 + "did you mean" suggestions on miss) + `/analysis` enriched with graph nodes/edges + scan info. HTTP bridge verified live against ~/flask: 83 modules; `flask/app.py` → 6 direct / 21 affected; missing file → 404 + suggestions.
- daemonClient.ts rewritten: fetchAnalysis, fetchImpact, watchEndpointsDir (auto-detect daemon via discovery file), SSE with reconnect backoff 1s→30s.
- extension.ts rewritten: auto-connect on endpoint-dir discovery, 30s status poll, `arclux.impact` command with quick-pick jump-to-file, `arclux.menu`/`refresh`/`connect`, workspace-folder-change reconnect, 3-severity diagnostics, full deactivate cleanup. package.json: commands + menus.
- Extension `pnpm build` clean.

## 2026-08-20 — Docs: ABOUT.md rewritten as the full ARCLUX map (PR #524)

**Status:** Done

ABOUT.md is no longer a feature list — it's a map: two-layer positioning (intelligence layer = flagship: parser/graph/impact/20 detectors/14 rules/security; platform layer = kernel/runtime/scheduler/services/storage/networking/notifications/orchestration), ASCII diagram, current-reality tables (10 languages, 20 detectors, security boundaries, remote adapters), honest not-done list. README link updated to "the ARCLUX map — start here". Follow-up to PR #519 which had corrected stale claims (db IS implemented, 10 parsers, cache 5/5) after user review.

## 2026-08-23 — v0.2.0 released + web feature wave (docs sync #559)
- v0.2.0-alpha tag + GitHub Release (08-21): 4x package.json, CITATION
  refreshed, CHANGELOG.md created. Repo description/topics updated.
- Post-release web wave (8 PR merged): CLI-web parity routes, audit
  feature (theater + graph halos), nav registry + Ctrl+K, playground
  TUI, pending indicators, JetBrains Mono, view-mode toggle.
- scripts/ restored (deleted by accident in #528 stash-pop).
- Machine gotcha (NEW): two AI sessions sharing one working dir =
  branch switches eat each other's uncommitted work. Second session
  now works in a separate clone (/root/arclux-pg) — port 3000
  conflicts were dev servers from BOTH sessions.
