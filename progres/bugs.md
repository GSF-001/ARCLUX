# ARCLUX Progress — Bugs & Fixes

Incidents found and how they were fixed. See PROGRES.md for the index.

## 2026-08-03 — Update — Python resolver bug + TS export default double-count bug (fixed)

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

## 2026-08-04 — Update -- ImpactSummary.tsx built and verified in-browser, plus 2 major Webpack gotchas found

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

## 2026-08-05 — Update — dark theme default fix + GraphMenu consolidation

**Dark theme bug found via dogfooding**: landing page and graph viewer
rendered light/white despite theme/theme.dark.ts being dark-first by
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

## 2026-08-06 — Update - manifest parser fix, export/import graph builders, call graph planning

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

## 2026-08-06 — CI typecheck ran from wrong directory

package.json's typecheck script ran plain 'tsc --noEmit' from repo root, breaking the @/* path alias (baseUrl is relative to apps/web/tsconfig.json). This caused ~30 false CI errors (missing react types, JSX implicit any, unresolved @/lib/utils etc.) across vendor-ui and playground/, blocking PR #108 (feat/repo-config-tooling) even though the code was fine. Fixed in PR #110 by changing the script to 'tsc --noEmit -p apps/web/tsconfig.json', matching the local dev command already documented in gotchas.md.

## 2026-08-07 — Dead theme/globals.css, stale PROGRES.md.bak, duplicate lockfile

Found and removed 3 leftover files during a routine check: apps/web/theme/globals.css (0 bytes, never imported anywhere -- app/globals.css at a different path is the one actually wired into layout.tsx), PROGRES.md.bak (outdated pre-split/pre-translate backup, superseded by progres/PROGRES-*.md), and package-lock.json (project uses pnpm per pnpm-workspace.yaml, having both lockfiles risks dependency drift -- added package-lock.json to .gitignore).

## 2026-08-08 — CI failing: react types not found in error.tsx files

**Status:** Not Started

6 app/**/error.tsx files fail typecheck with 'Could not find a declaration file for module react'. Pre-existing on main, unrelated to docs/security-coc-badge PR. Needs investigation next session.

## 2026-08-08 — 10 pre-existing lint errors surfaced after turbo fix

**Status:** Not Started

CI lint step now runs (was crashing before due to missing turbo.json). Reveals real errors: vendor-ui/aceternity/text-generate-effect.tsx and card-hover-effect.tsx (prefer-const, missing useEffect deps, unused var 'idx'), app/api/analyze/route.ts#L56 (unused '_repository'). Not fixed yet -- separate task from the CI config fix.

## 2026-08-08 — spring-boot graph showed disconnected nodes (implicitDependencies not wired)

**Status:** Done

Fixed: buildDependencyGraph.ts only read module.imports, never module.implicitDependencies (set by resolveSameScopeDependencies.ts for Go/Java same-package refs with no import statement). Caused Java-heavy repos like spring-boot to render all file nodes with zero edges. Fixed by adding a second edge-building pass reading implicitDependencies.

## 2026-08-08 — CI failing: npm vs pnpm mismatch caused missing @types/react

**Status:** Done

Fixed in stages: (1) ci.yml used npm install despite project being pnpm-workspace based, causing apps/web deps like @types/react to not install correctly in CI. (2) pnpm/action-setup conflicted with package.json's packageManager field (duplicate version spec). (3) pnpm-lock.yaml was outdated vs package.json (missing @radix-ui/react-accordion, @radix-ui/react-scroll-area), causing --frozen-lockfile to fail. (4) package.json scripts still called 'turbo run ...' after turbo.json was removed in an earlier session, causing lint/dev/build to crash outright. All four now fixed -- CI reaches the actual lint/test steps instead of crashing before them.

## 2026-08-08 — 10+ real lint/type errors surfaced now that CI reaches lint step

**Status:** Not Started

Now that CI's lint step actually runs (previously crashed before reaching it), real pre-existing issues are visible: prefer-const violations and missing useEffect deps in vendor-ui/aceternity/*.tsx, unused vars in app/api/analyze/route.ts, and two setState-called-synchronously-in-effect errors in AnalyzingProgress.tsx and GlobalSearch.tsx (react-hooks/set-state-in-effect). Not fixed yet -- next session should start here to get CI fully green.

## 2026-08-08 — Manifest parsers never wired to a registry (affects ALL of them, not just new ones)

**Status:** Not Started

Confirmed: parseGemfile.ts, parseCargoToml.ts, parseGoMod.ts, parseComposer.ts, parsePackageJson.ts, parseCsproj.ts, parseGradlePom.ts, and now parseRequirements.ts all implement ManifestParser correctly but NONE are referenced anywhere outside their own file -- no ManifestRegistry equivalent to ParserRegistry (for LanguageParser) exists. Dependency-manifest parsing is effectively 100% dead code right now, despite several manifest parsers being 'done'. Needs a ManifestRegistry (or similar wiring into detectRepositoryMeta.ts, per ManifestParserInterface.ts's own doc comment mentioning that file) before any of this has real effect.

## 2026-08-09 — Python repos show zero graph edges (mscodebase-intelligence test)

**Status:** Not Started

parsePython.ts registered correctly, extractImports() exists. But analyzing a real Python repo (ManSio/mscodebase-intelligence) shows zero edges despite files clearly importing each other. parsePython IS registered in pipeline.ts. Suspect resolvePath.ts fails to resolve Python-style imports (e.g. 'from src.core import X') to module IDs. Needs investigation next session -- check resolvePath.ts's import resolution logic against Python's import syntax specifically.

## 2026-08-09 — Python dotted absolute imports silently dropped in resolvePath.ts

**Status:** Done

Real repos analyzed with Python showed zero graph edges despite files clearly importing each other. Root cause (found by ManSio, issue #186): parsePython.ts correctly extracts dotted import strings like src.core.embedder, but resolvePath.ts only recognized relative paths and slash-based specifiers, so any bare specifier containing a dot fell through to the external-package branch and the edge was silently dropped. Fixed by converting dots to slashes and trying both repo-root and importer-relative resolution before falling back to external. Side effect confirmed harmless: a bare specifier like lodash.get now also hits this branch, tries lodash/get.py, fails, falls through to external as before -- no-op for JS/TS repos. Merged via PR #192, closes #186.

## 2026-08-09 — categorize() in detectAmbiguousSymbolResolution used case-sensitive substring matching, not segment matching

**Status:** Done

Flagged by ManSio on the original issue thread after the detector was already merged. Two concrete failures: (1) case-sensitivity -- a directory named TEST/ (uppercase) matched no category at all. (2) no path-segment boundary awareness -- a directory named src-test could be misclassified since checks were plain substring containment rather than exact segment matching, silently downgrading a high-severity finding to medium. Fixed by lowercasing the full path once, splitting into segments, and checking exact set membership per segment instead of substring containment. Regression covered by two of the four new tests in tests/detector.test.ts.

## 2026-08-09 — Python exports show 0 for ALL files, even ones with top-level classes (mscodebase-intelligence test)

> **[STATUS UPDATE, 2026-08-10]: this plan is now implemented.** See "UPDATE: Python parsing silently fails due to wasm path resolution matching webpack's .wasm rule — implemented" below.

**Status:** Not Started

Deeper investigation of the zero-edges issue: exportCount is 0 for literally every Python file analyzed, including files with obvious top-level class/function definitions (src/core/graph.py has 5+ top-level classes: Node, Edge, PropertyGraph, NodeLabel, EdgeType). This means the bug is in extractExports, not just resolvePath.ts -- resolvePath.ts can't create edges for exports that were never extracted in the first place. Needs investigation of parsePython.ts's extractExports function next session -- not yet checked.

## 2026-08-09 — parsePython.ts: exports:[] on line 207 is inside catch block -- need to check if exception is silently thrown

**Status:** Not Started

Traced further: return { file, imports, exports, warnings } at the normal path DOES call extractExports() correctly. The exports:[] seen is only in the catch block (parse failure fallback). Need to check: is getPythonRuntime() or parser.parse() throwing silently for mscodebase-intelligence's files? Check warnings array in actual API response next -- if warnings has a 'Failed to parse' message, that confirms it. Not checked yet.

## 2026-08-09 — extractExports() in parsePython.ts skipped decorated top-level definitions

**Status:** Not Started

root cause of exportCount 0 across most Python files (e.g. mscodebase-intelligence src/core/graph.py). tree-sitter wraps @decorator-annotated class/function_definition inside a decorated_definition node instead of exposing it directly as a root.namedChildren sibling -- the type check only looked for function_definition/class_definition directly, so anything decorated was silently skipped. Not an exception-swallowing bug (the earlier "check catch block" hypothesis was not it) -- pure logic gap, no error ever thrown. Fixed by unwrapping decorated_definition to its childForFieldName("definition") before the type check.

## 2026-08-10 — UPDATE: Python parsing silently fails due to wasm path resolution matching webpack's .wasm rule — implemented

**Status:** Done

Root cause confirmed and fixed via PR #[isi setelah tau nomor]: resolving tree-sitter-wasms .wasm path directly matched next.config.ts's webpack .wasm rule, rewriting the path into a virtual asset reference that broke Language.load() at runtime. This caused Python parsing to silently fail for every file (caught by parsePython.ts's try/catch), returning empty imports AND exports with no visible error. Fixed by resolving via package.json instead. Verified against a real 323-file Python repo: graph.edges.length went from 0 to 607.

## 2026-08-10 — Python parsing silently failed due to wasm path matching webpack rule (ROOT CAUSE FOUND)

**Status:** Done

Confirmed: resolving tree-sitter-wasms .wasm path directly matched next.config.ts's webpack .wasm rule, rewriting it into a virtual asset path that broke Language.load() at runtime. Every Python file silently returned empty imports AND exports (caught by parsePython.ts's try/catch, no visible error). This was the actual root cause behind the exportCount:0 and zero-graph-edges bugs -- not primarily a resolvePath.ts issue, though PR #192's dotted-import fix was still necessary once parsing actually started working. Fixed by resolving tree-sitter-wasms/package.json instead of the .wasm file directly. Verified against a real 323-file Python repo: graph.edges.length went from 0 to 607, 838 resolved imports across 199 modules.

## 2026-08-10 — detectCircularDependency reported duplicate cycles (fixed via ManSio, issue #207)

**Status:** Done

A cycle was reported once per node still unresolved when the outer loop's for-of reached it -- a 2-node cycle produced 2 identical findings, a 3-node cycle produced 3. Fixed via canonicalizeCycle() (rotate to lexicographically smallest node) + a seenCycles dedup set. No interface changes. Reported and fixed by ManSio, landed with their test cases.

## 2026-08-10 — nodeRequire.resolve() returns non-absolute path for tree-sitter-python.wasm inside Next.js webpack runtime

**Status:** Done

Root cause of graph.edges=0 across ALL Python repos in the browser, despite direct tsx testing showing the parser/resolvePath/buildDependencyGraph logic was correct (607 edges for mscodebase-intelligence). nodeRequire.resolve("tree-sitter-wasms/package.json") returns a path relative to the webpack bundle location, not a real filesystem path, when running inside Next.js dev/build (confirmed via step-by-step console.error debugging: it returned "../node_modules/..." which existsSync() correctly reported as not existing). This made Language.load() throw an opaque WASM binding error ("invalid type: unit value, expected usize") that was caught by parsePython.ts outer try/catch and silently returned empty imports/exports per file, with the warnings array never surfaced anywhere in the API response. A second contributing factor made this hard to diagnose: apps/web/app/api/graph/route.ts skipped console.error for ArcluxError responses, so even the generic "Indexing failed" wrapper error never appeared in server logs -- had to add cause to the JSON response to see it. Fixed by building the wasm path from process.cwd() instead of nodeRequire.resolve(), still reading the installed version dynamically from tree-sitter-wasms own package.json to avoid hardcoding. Verified end-to-end against a real running dev server: 607 edges for mscodebase-intelligence.

## 2026-08-11 — GraphFocusView.tsx: back arrow was decorative, no navigation history existed at all

**Status:** Done

The ArrowLeft icon next to "This file needs" in GraphFocusView.tsx looked like a back button but was just a static icon inside a <div>, no onClick, no button element. Confirmed by reading the component source directly rather than guessing from the UI -- there was no history stack anywhere in GraphProvider.tsx either; selectNode() just overwrote selectedNodeId with no memory of what was selected before. Fixed by adding a focusHistory stack + goBackFocus()/canGoBack to GraphProvider.tsx (selectNode pushes the previous node onto the stack when switching to a different node, resets history on deselect), and moving the back arrow into the panel header as a real button wired to goBackFocus(). Verified via tsc --noEmit and in-browser click-through (A -> B -> C, back button returns to B).

## 2026-08-11 — GraphFocusView.tsx: MAX_CARDS_PER_SIDE=12 hard cap made most affected files unreachable, not just uncounted

**Status:** Done

User reported a file with (25) shown in the "affects" header but only a handful of cards visible and scrolling did nothing. Root cause found by reading the actual component code (not guessing from the screenshot): dependencies/dependents arrays were .slice(0, 12) before rendering, with the remainder shown only as static text ("+13 more") -- not a button, not scrollable, permanently unreachable. First fix attempt removed the cap entirely (render all), which surfaced a real follow-up concern from the user: a file with hundreds of affected files would render all of them at once and could make the panel heavy/unusable. Second iteration: replaced the hard cap with INITIAL_VISIBLE=30 + a real clickable expand button per side (not a dead label), with expand state reset via useEffect when selectedNodeId changes so navigating to a new file does not carry over a previous file stay-expanded state. Lesson: match the fix to the actual reported symptom before generalizing -- "remove the cap" and "cap with expand-on-demand" are different designs, worth confirming with the user before defaulting to the simplest read of the bug report.

## 2026-08-13 — ProcessManager pid never persisted, causing ps to always show empty

**Status:** Done

ProcessManager.start() mutated entry.pid/entry.startedAt directly on the in-memory ProcessTable object after spawn, bypassing Kernel's persistence write. The on-disk record kept pid: null forever, so SnapshotManager.readLiveProcessRecords()'s liveness check (process.kill(pid, 0)) always failed and immediately deleted the record. Fixed by adding Kernel.setProcessRuntimeInfo() which mutates and persists atomically; ProcessManager now calls that instead of mutating the table entry directly.

## 2026-08-14 — diagnose OOM crash on large repos (Django) — fixed

**Status:** Done

apps/cli/index.ts diagnose crashed with JavaScript heap out of memory on Django (~989 unique moduleIds across 650 findings), even with NODE_OPTIONS=--max-old-space-size=4096 (4GB). Root cause: packages/diagnostics/ErrorContext.ts attachImpactContextToAll called getImpactNavigation() once per unique moduleId and retained the FULL ImpactNavigationResult (including a materialized affected-files array and a complete impact tree from buildImpactTree) for all of them simultaneously in memory. But packages/diagnostics/DiagnosticEvent.ts only ever reads .totalAffected (one number) from each result -- the array and tree were computed and retained for nothing. Fix: added getImpactCount() to packages/editor/ImpactNavigator.ts, a lightweight variant that skips buildImpactTree entirely and returns just the affected-file count. ErrorContext.ts now caches numbers (Map<string, number>) instead of full ImpactNavigationResult objects, shared across all findings in one diagnose run. Verified: diagnose ~/django now completes successfully with NODE_OPTIONS=--max-old-space-size=4096, printing all findings and affects N file(s) counts correctly. Without the memory flag it likely still needs it for a repo this size (Django is ~1300 files touched per impact call) but no longer crashes with it set.

## 2026-08-14 — loadAliasConfig doesn't handle per-app tsconfig in monorepo (root cause not found)

**Status:** Not Started

packages/graph/resolveAliases.ts's loadAliasConfig only reads repoRoot's tsconfig.json, not apps/*/tsconfig.json. Confirmed via ARCLUX doctor run against its own repo: apps/web/components/* (Navbar, Sidebar, WorkspaceLayout, Breadcrumbs, etc -- ~235 files) show as unusedExports/orphanFiles false positives because their '@/...' imports resolve against root's tsconfig paths (which point at repo root) instead of apps/web/tsconfig.json's paths (which point at apps/web/). Attempted a fix this session (merge rules from repoRoot + every apps/*/tsconfig.json) but loadOneConfig() mysteriously returned [] even with a confirmed-valid, confirmed-parseable tsconfig.json -- root cause not found before running out of budget. Reverted the broken attempt cleanly; resolveAliases.ts is unchanged from before this session (bug still present, nothing new broken). See issue on GitHub for reproduction + suggested next debugging step.

## 2026-08-15 — Python WASM path regression #3 — require.resolve() reintroduced again, fixed with directory walk-up

**Status:** Done

Same failure mode as the two prior regressions (2026-08-10 entries): parsePython.ts's getPythonRuntime() had again been changed to use require.resolve('tree-sitter-wasms/out/tree-sitter-python.wasm') directly, despite an explicit in-code warning comment saying not to -- this returns a webpack-bundle-relative path (not a real filesystem path) inside Next.js's dev/build runtime, causing Language.load() to fail silently, caught by the outer try/catch, returning empty imports/exports per file with zero visible error. Symptom: graph showed only isolated file nodes with no edges when analyzing Python repos (ManSio/mscodebase-intelligence, pallets/flask), identical to issue #186's original symptom. First fix attempt (path.join(process.cwd(), 'node_modules', ...)) was incomplete: process.cwd() depends on where the dev server is started (repo root vs apps/web), and pnpm hoists tree-sitter-wasms to the monorepo root's node_modules only, not apps/web's -- so starting the server from apps/web (the documented way, per QUICKSTART.md) broke the naive path. Final fix: findWasmPath() walks upward from process.cwd() (same algorithm Node's own module resolution uses) checking node_modules/tree-sitter-wasms/out/tree-sitter-python.wasm via existsSync at each level, instead of assuming a fixed relative depth. Verified end-to-end: dev server started from apps/web, analyzed pallets/flask (previously zero edges), graph now shows real dependency edges between files. Process note: this is the THIRD time this exact bug has regressed after being fixed. The in-code comment warning against require.resolve() clearly did not prevent it. Worth considering a regression test that asserts parsePython.ts never calls require.resolve/nodeRequire.resolve, if that becomes feasible.

## 2026-08-15 — Fixed broken contributor CLI files (open.ts syntax error, unregistered edit/open/verify)

**Status:** Done

Contributor commit added apps/cli/commands/{edit,logs,open,verify}.ts using export const xCommand pattern (not matching registerXCommand convention), none registered in index.ts. open.ts had unterminated template literal (backtick opened, quote closed) -- syntax error, failed tsc entirely. commands/verify.ts duplicated existing registered apps/cli/verify.ts. edit.ts/open.ts also diverged from our CodeNavigator-based design from earlier this session (dependency/consumer navigation) with a different concept (replace file content wholesale). Fix: rewrote edit.ts/open.ts using CodeNavigator (openFile/listDependencyTargets/listDirectConsumerTargets), registered both in index.ts, deleted duplicate commands/verify.ts. logs.ts left unregistered -- assumes ~/.arclux/logs/*.log files which nothing in the codebase writes (state is JSON via SnapshotManager, not log files); needs its own fix before wiring in.

## 2026-08-15 — CI failing: tests/impact.test.ts all 6 tests fail, repository.getModule is not a function

**Status:** Fixed (PR #426, closes issue #424)

Original diagnosis ("mock/plain object doesn't implement getModule") was inaccurate. Root cause: impact functions were refactored from `(moduleId, graph)` to `(repository, moduleId)` and the test file still used the old signature on an empty Repository (which also has no `graph` property — graph is built separately by buildDependencyGraph). Fix: rewrote tests/impact.test.ts with real ModuleInfo fixtures (makeModule/makeRepository convention from tests/graph.test.ts) covering chain (entry->service->repository), circular (a->b->c->a, cycle guard), fan-out (a->{b,c}) and notFound behavior — 12 tests, all green. Related: tests/pipeline.test.ts fixed in PR #427 (issue #425): `/tmp/test` ThreatCrush finding was a false positive (path never touched — throws before I/O), replaced with portable os.tmpdir() path; weak `moduleCount >= 0` assertions replaced with deterministic fixture (tests/fixtures/pipeline-basic/, entry->service->repository) asserting exact moduleCount/edges/scanSummary (~1.8s -> ~22ms).

## 2026-08-15 — Python relative imports resolve as external: from .x / from ..x / bare . and .. dropped from graph

**Status:** Fixed (PR #431, closes issue #429)

Python files using relative imports got ZERO dependency edges: `from .repository import x` in pkg/service.py, `from ..utils import x` in pkg/repository.py, `from .service import x` in pkg/__init__.py — all resolved as external. Root cause: resolvePath handled every leading-dot source with the JS branch (posix.join+normalize), which only resolves `/`-separated segments; Python's `.x`/`..x` are single segments, so normalize("pkg/..utils") stays "pkg/..utils" and never matches. Fix: dots-without-slash → Python package-relative branch (N dots = N-1 dirname steps up + dotted suffix); JS `./x`/`../x` untouched (naive `/^\.+(?!\/)/` lookahead misclassifies `../x` via regex backtracking — fixed with full-dot-run + explicit char check). +11 unit tests (tests/resolvePath.test.ts, first ever for this file) + first e2e for Python parser (tests/python-e2e.test.ts on tests/fixtures/python-basic/: all 3 relative forms produce exact graph edges).

## 2026-08-15 — CommonJS whole-object exports not extracted: module.exports = { a, b } silently yields zero exports

**Status:** Fixed (PR #432, closes issue #430)

Known gap (documented in extractJs.ts + PROGRES.md): extractExportsJs only recognized per-property assignment (module.exports.NAME=/exports.NAME=); `module.exports = {…}` has bare LHS `module.exports` which matchCommonJsExportTarget never matched — exports silently dropped. Fix: bare `module.exports =`/`exports =` with ObjectLiteralExpression RHS → each property is a named export (shorthand `{a}`, renamed key `{foo: renamed}` → "foo", string keys, methods/getters; spread + computed keys skipped). +6 tests in tests/parser/javascript.test.ts. Single-value assignment (`module.exports = fn`) still out of scope (follow-up).
