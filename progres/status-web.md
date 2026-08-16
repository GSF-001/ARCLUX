# ARCLUX Progress — Web (apps/web components, graph viewer, vendor-ui, theme)

See PROGRES.md for the index. Split by topic from the original PROGRES-status.md.

## 2026-08-03 — ✅ DONE — UI: layout, primitives, patterns (partial), marketing

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

- **`components/overview/*`** — only `ProjectStructure.tsx` (99 lines, file
tree UI, collapsible, uses `d3-hierarchy`) is complete. `RepositoryHeader`,
`RepositoryInfo`, `RepositoryOverview` are still stubs.

> **[STATUS UPDATE, 2026-08-14]: resolved — RepositoryHeader/Info/Overview
> implemented and mounted on the [org]/[repo] root page (see
> progres/status-web.md "Overview page implemented").**

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

## 2026-08-03 — ✅ DONE — UI: graph viewer

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

## 2026-08-03 — ✅ DONE — vendor-ui

Everything in `vendor-ui/shadcn/*` (avatar, badge, button, checkbox,
command, dialog, dropdown-menu, input, input-group, popover, select,
separator, sheet, skeleton, switch, tabs, textarea, toast, tooltip),
`vendor-ui/aceternity/*` (5 files), `vendor-ui/magic-ui/*` (6 files,
including `file-tree.tsx` at 511 lines — the largest file in the whole
project), and `vendor-ui/_inbox/*` (4 custom files: neon-glow-card,
code-block-terminal, graph-particles-bg, keyboard-shortcut-hint) — all
installed/written in full.

---

## 2026-08-04 — Update — /api/impact and /api/search implemented (from empty stubs)

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

## 2026-08-04 — Update — components/patterns/* 8 stub files are now DONE

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

## 2026-08-05 — Update — Graph node icons + edge labels/arrows (visual polish, dogfood-driven)

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

## 2026-08-05 — Update — GraphFocusView (new): replaces overlapping edge labels on high-fan-in nodes

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

## 2026-08-05 — Update -- components/workspace/* 8 stub files are now DONE

> **[STATUS UPDATE, 2026-08-14]: the "Workspace.tsx is not wired into any
> app/ route yet" note below is now RESOLVED — WorkspaceLayout (Navbar +
> Sidebar + Breadcrumbs) is the shared [org]/[repo] layout, and
> Workspace is mounted at /[org]/[repo]/workspace. See the
> "Workspace shell mounted" entry below.**

Wrote all 8 files: Workspace.tsx (composition root), WorkspaceHeader.tsx,
WorkspaceCommand.tsx, WorkspaceSearch.tsx, WorkspaceSwitcher.tsx, and
panels/{Files,Impact,Issues}Panel.tsx.

Reference used: browsed ~/git-truck/src/routes/view.tsx and RevisionSelect.tsx
for composition/dropdown-switcher PATTERNS only (concept, not code -- that
project is React Router SSR with a completely different loader/action
model, not directly portable to Next.js App Router). No code copied, no
NOTICE entry needed since nothing was adapted verbatim.

Real vs honest-placeholder breakdown:
- WorkspaceSwitcher.tsx: functional for switching between recently-viewed
  repos (client-side list), but branch switching is NOT functional yet --
  pipeline.ts accepts a branch param but no UI lets the user pick one.

> **[STATUS UPDATE, 2026-08-14]: resolved — branch switching works.
> packages/git/getBranches.ts + detectDefaultBranch.ts implemented
> (git ls-remote, no clone) behind GET /api/branches; WorkspaceSwitcher
> lists branches and the workspace refetches panels on change. See
> "Branch switcher" below.**
- WorkspaceSearch.tsx: real, hits GET /api/search (fuzzyScore.ts stopgap,
  same caveats as documented on that route -- file-path-only, no caching,
  re-indexes whole repo per call).
- WorkspaceCommand.tsx: thin wrapper re-exporting the already-built
  CommandPalette.tsx, not new behavior.
- ImpactPanel.tsx: real, wraps the already-verified ImpactSummary.tsx.
  Needs a moduleId, which currently only comes from WorkspaceSearch
  selection (no file tree to click into yet).
- FilesPanel.tsx: honest "coming soon" EmptyState, NOT a fake file tree.
  Blocked on either fixing vendor-ui/magic-ui/file-tree.tsx's missing
  deps (@radix-ui/react-accordion, scroll-area.tsx) or building a simpler
  tree view from graph data directly.

> **[STATUS UPDATE, 2026-08-14]: resolved — the "building a simpler tree
> view" option won: POST /api/analyze gained a server-side `folderTree`
> (issue #330) and FilesPanel renders it via ProjectStructure, wired to
> the workspace selection state. See "FilesPanel real file tree" below.**
- IssuesPanel.tsx: honest "coming soon" EmptyState, NOT fake detector
  data. Detectors themselves are 18/18 done and already run via `apps/cli
  doctor`, but nothing exposes them over HTTP yet -- needs a new
  /api/doctor route.

> **[STATUS UPDATE, 2026-08-14]: resolved — /api/doctor exists
> (packages/engine/runDoctor.ts, all 19 detectors normalized to one flat
> finding list) and IssuesPanel renders it grouped by severity. See
> "IssuesPanel + /api/doctor" below.**

Verification: npx tsc --noEmit -p apps/web/tsconfig.json clean (only the
2 pre-existing file-tree.tsx errors, unrelated). NOT yet verified
visually in-browser -- Workspace.tsx is not wired into any app/ route yet
(app/[org]/[repo]/page.tsx still shows its old "coming soon, see /graph"
placeholder). Wiring it in and browser-testing is deliberately left as
separate follow-up work, to keep this change's review surface to "the
workspace components exist and typecheck" rather than also redoing the
main repo page.

## 2026-08-06 — Update -- hooks/useDebounce.ts + components/search/GlobalSearch.tsx implemented

useDebounce.ts: generic debounce-a-value hook (standard setTimeout/
clearTimeout pattern). GlobalSearch.tsx: standalone search component
hitting GET /api/search, using this hook.

IMPORTANT CONTEXT: an earlier draft of GlobalSearch.tsx was floated (via
external chat, never committed to this repo) that hardcoded
`items: SearchItem[] = []` with a comment saying data would come from
"SearchProvider / API" later -- meaning the search box would render and
accept input but silently return zero results forever, looking
functional while doing nothing. That draft was never written to disk and
is NOT what's implemented here. This version actually calls /api/search
and returns real results (same fuzzyScore.ts stopgap backing
WorkspaceSearch.tsx and CommandPalette-adjacent search, with the same
caveats -- file-path-only, no caching, re-indexes the whole repo per
call).

Deliberate overlap with components/workspace/WorkspaceSearch.tsx: both
hit the same API with the same debounce-then-fetch shape.
WorkspaceSearch.tsx is scoped to the workspace header (compact inline
dropdown) and inlines its own debounce logic rather than using this new
hook. GlobalSearch.tsx is the general-purpose version (e.g. for a global
navbar), shows an EmptyState on zero results, and uses useDebounce. Not
merged into one component since their result-UI differs. If this
divergence becomes annoying to maintain, consider extracting a shared
useRepoSearch(repoUrl, branch, query) hook both could call -- not done
here to keep this change scoped.

NOT yet wired into any page/navbar -- same status as most workspace
components, exists and typechecks but has no real consumer yet.

Verification: npx tsc --noEmit -p apps/web/tsconfig.json clean (only the
2 pre-existing file-tree.tsx errors, unrelated). Not yet visually
verified in-browser.

## 2026-08-06 — Update — theme/typography.ts, spacing.ts, motion.ts written (globals.css left untouched)

Three token files written from scratch: `apps/web/theme/typography.ts`
(font size/weight/line-height scale + graph label sizes),
`apps/web/theme/spacing.ts` (spacing scale + graph layout pixel
constants), `apps/web/theme/motion.ts` (duration/easing + interaction
timing constants like double-click window).

**IMPORTANT — `apps/web/app/globals.css` was checked (209 lines,
NOT a stub) and deliberately NOT touched.** It already carries the
dark-first ARCLUX theme applied in an earlier session — do not run any
"fill empty file" pass against it again, it only looks like a candidate
if you trust file NAME/folder location without checking actual line
count first (same class of mistake flagged repeatedly elsewhere in this
doc).

**NOT YET DONE**: none of these 3 new token files are actually imported
anywhere yet — GraphCanvas.tsx's `DOUBLE_CLICK_DELAY_MS` and similar
inline constants are still local, not migrated to import from
motion.ts's `interactionTiming`. Wiring these in is a follow-up, kept
out of scope here to avoid touching working interaction code just to
satisfy new token files existing.

STATUS: pushed near a chat context limit — typecheck result for these 3
files was requested but not confirmed back before this note was written.
Re-run `npx tsc --noEmit -p apps/web/tsconfig.json` and confirm clean
before trusting these beyond "written, looks syntactically right."


## 2026-08-07 — useGraph re-export + centralized fetch helpers

apps/web/features/graph/useGraph.ts implemented as a thin re-export of GraphProvider's useGraphContext() (per the 2026-08-03 decision). The other 4 files in features/graph/ stay deliberately empty but now have explanatory comments. Also implemented lib/api.ts (fetchJson helper: query params, res.ok check, error parsing) and lib/graph.ts (fetchGraph wrapping /api/graph), then refactored GraphProvider.tsx and DependencyList.tsx to use fetchGraph() instead of each having its own duplicated inline fetch block.

## 2026-08-07 — useGraph re-export + centralized fetch helpers

apps/web/features/graph/useGraph.ts implemented as a thin re-export of GraphProvider's useGraphContext() (per the 2026-08-03 decision). The other 4 files in features/graph/ stay deliberately empty but now have explanatory comments. Also implemented lib/api.ts (fetchJson helper: query params, res.ok check, error parsing) and lib/graph.ts (fetchGraph wrapping /api/graph), then refactored GraphProvider.tsx and DependencyList.tsx to use fetchGraph() instead of each having its own duplicated inline fetch block.

## 2026-08-07 — README fixes: pnpm run dev, Contributors section clarified

Fixed a leftover 'npm run dev' instruction in README.md's web dashboard section (earlier npm->pnpm cleanup only caught 'npm install', missed this). Also: Contributors section was intentionally removed by user via direct GitHub edit -- a later session mistook this for accidental damage and restored it, then reverted after user clarified it was intentional. See decisions.md for the full context so this doesn't happen a third time.

## 2026-08-08 — LOD step 2: label gating done

**Status:** Done

GraphNode.tsx now gates label visibility on zoom level, matching the icon LOD from step 1: labels hidden below zoomScale 0.5, always shown above 1.5 for high-importance nodes (importCount >= IMPACT_MEDIUM_THRESHOLD), unchanged (hover/select only) in between. Not yet visually verified in-browser -- user will check separately. See decisions.md's LOD entry for the full 3-step plan; step 3 (node radius scaling at low zoom + visual verification) still open.

## 2026-08-09 — Explorer.tsx tabbed panel + DependencyList.tsx, plus missing vendor component

**Status:** Not Started

apps/web/components/explorer/Explorer.tsx (new) wraps existing FileDetails.tsx and ImpactSummary.tsx plus new DependencyList.tsx into a tabbed panel (File/Dependencies/Impact). Zero prior consumers confirmed via grep before writing, so the prop shape is a new design, not an established contract. vendor-ui/shadcn/scroll-area.tsx was missing, blocking file-tree.tsx typecheck alongside a missing @radix-ui/react-accordion dependency; both fixed. tsc clean. Explorer.tsx not mounted on any page yet. Not visually verified in browser.

## 2026-08-10 — Next.js API still returns graph.edges=0 while direct pipeline returns 607

**Status:** In Progress

Confirmed pnpm typecheck (tsc --noEmit -p apps/web/tsconfig.json) passes clean, and pnpm test passes 5 test files / 23 tests. Direct analyzeRepository() via tsx produces 323 nodes and 607 edges for ManSio/mscodebase-intelligence, proving parser/indexer/resolvePath/buildDependencyGraph work outside Next.js. Running Next.js 16.2.12 with webpack on localhost, the real /api/graph request (verified via curl, not just browser) returns HTTP 200 with 323 nodes but 0 edges for the same repo. Therefore the issue is narrowed to the Next.js server runtime/request path or webpack-specific behavior, not the core graph engine -- no code fix applied yet. Leading hypothesis, not yet confirmed: the earlier .wasm webpack fix (see gotchas 2026-08-04 entry) may not be effective inside the real webpack-bundled runtime that serves browser requests, even though it works when called directly via tsx (which bypasses webpack entirely). getPythonRuntime() could be silently failing and hitting the catch-all in parsePython.ts, which returns empty imports/exports with only a warnings[] message -- DependencyGraph has no field to surface that to the API response. Next step: inspect the pnpm run dev terminal log at the exact moment an /api/graph request is made, looking for ENOENT or "Failed to parse" lines, before writing any fix.

## 2026-08-11 — GraphNode memoized to reduce re-renders

**Status:** Done

GraphNode.tsx wrapped in React.memo -- previously every node instance re-rendered on any GraphCanvas.tsx transform change (pan/zoom), even when that node's own props were unchanged. On graphs with hundreds of nodes this meant hundreds of wasted re-renders per pan/zoom frame. Default shallow compare sufficient since props are primitives/stable refs. Not benchmarked with before/after numbers, just a structural fix based on an obvious gap.

## 2026-08-14 — Hooks done (issue #147) + /api/search on the real engine (issue #9)

> **[STATUS UPDATE, 2026-08-14]: the "useClipboard/useCommandPalette/
> useDebounce/useMediaQuery still stubs" line above is stale — the 3
> remaining hooks are now implemented, and the "/api/search ...
> stopgap, SearchEngine.ts still 0%" note is obsolete.**

**Status:** Done

- `hooks/useMediaQuery.ts` — thin wrapper over `@base-ui/react`'s
  `unstable-use-media-query` (issue note: prefer re-export over
  reimplementation).
- `hooks/useClipboard.ts` — async Clipboard API + execCommand fallback,
  `copied`/`error`/`copy` with auto-reset.
- `hooks/useCommandPalette.ts` — owns open-state + global shortcuts
  (Cmd/Ctrl+K, "/", Escape); `CommandPalette.tsx` refactored to consume
  it (its inline keydown effect removed). Exported standalone for other
  surfaces.
- `/api/search` rewritten to use `buildSearchIndex` + `search` from
  packages/search (issue #9); response shape unchanged
  (`{ query, results: [{ moduleId, filePath, score }] }`).
- Notes: WorkspaceSearch.tsx above says it hits the fuzzyScore
  stopgap — that's since upgraded to the real search engine (issue #9),
  response shape unchanged; GlobalSearch (08-06 entry below) is now
  mounted on the [org]/[repo]/search page.
- tsc exit 0, eslint 0 on all changed files; not visually verified in
  browser (same standard gap as other entries).

## 2026-08-14 — Workspace shell mounted: shared [org]/[repo] layout + /workspace route

**Status:** Done

- New `app/[org]/[repo]/layout.tsx` renders the pre-existing
  WorkspaceLayout (Navbar + Sidebar + Breadcrumbs) around every repo
  page — previously the pages rendered standalone full-screen with no
  app chrome.
- New `/[org]/[repo]/workspace` route renders the Workspace composition
  root (WorkspaceHeader switcher+search, CommandPalette, Files/Impact/
  Issues split pane); Sidebar gained a Workspace link.
- Search page upgraded: mounts GlobalSearch (its "waiting on
  SearchEngine" placeholder was stale — the engine landed in issue #9).
- Page heights adjusted h-screen → h-full so pages fit inside the
  shell's flex column; RepositoryHeader nav links dropped (Sidebar owns
  navigation — no duplicate chrome).
- Verified live: overview/graph/search/workspace/settings all HTTP 200
  on a dev server, shell present in SSR, no server errors; tsc 0,
  eslint 0, vitest 196/196. Not visually verified in a real browser
  (standard gap).

## 2026-08-14 — Explorer panel mounted into the graph page (backlog item)

> **[STATUS UPDATE, 2026-08-14]: the "Explorer.tsx not mounted on any
> page" notes (2026-08-06 "Still not done" list + status-backlog 08-11
> entry) are now RESOLVED.**

**Status:** Done

GraphViewport is now a flex row: canvas column (flex-1) + a 380px
Explorer panel on the right, mounted when a FILE node is selected
(folders/external packages have no file source — FileDetails hits
/api/file). Explorer is a flex SIBLING of the canvas column, so
GraphFocusView's inset-4 overlay never collides with it; closing the
Explorer deselects the node, closing the focus view alone keeps it open.
Graph page SSR smoke-tested on a live dev server (HTTP 200, no errors);
tsc 0, eslint 0. Not visually verified in a real browser (standard gap).

## 2026-08-14 — Overview page implemented ([org]/[repo] root page)

> **[STATUS UPDATE, 2026-08-14]: the "components/overview/* — only
> ProjectStructure is complete, RepositoryHeader/Info/Overview are
> stubs" line above is now resolved — all three are implemented and the
> [org]/[repo] root page renders them.**

**Status:** Done

[org]/[repo]/page.tsx (was a "coming soon" placeholder) now renders
RepositoryOverview: RepositoryHeader (org/repo + branch badge + nav
links), RepositoryInfo (stat strip: modules/nodes/edges/frameworks/
package manager/dependencies/analyzedAt), and the interactive
ProjectStructure file tree. POST /api/analyze now also returns a
server-side `folderTree` (buildFolderGraph — needs the Repository, which
never leaves the server); lib/api.ts gained a `postJson` helper. Verified
live: /api/analyze on ARCLUX → 533 modules, folderTree root 8 children,
packages/ 36 children; overview page HTTP 200; tsc 0, eslint 0. Not
visually verified in a real browser (standard gap).

## 2026-08-14 — IssuesPanel + /api/doctor (workspace Issues tab is now real)

**Status:** Done

- `packages/engine/runDoctor.ts` (new): runs all 19 detectors and
  normalizes every finding to `{ checkId, severity, filePath?, message
  }` — the HTTP counterpart of `arclux doctor`'s terminal print.
  Severity per family: structural = error, hygiene/conventions =
  warning, informational classifiers (entryPoints, sharedModules, pure
  barrels) = info; ambiguous symbols map high→error, medium/low→warning.
- `POST /api/doctor` (new route): analyzeRepository → runDoctor →
  `{ repoUrl, findings, errorCount, warningCount, infoCount }`.
- `IssuesPanel` (was an honest "no issues panel yet" placeholder):
  fetches /api/doctor, renders findings grouped error → warning → info
  with severity dots + checkId + filePath + message; loading/error/retry
  states. `Workspace.tsx` passes repoUrl/branch through.
- Verified live: POST /api/doctor on GSF-001/ARCLUX → 200, 1203 findings
  (767 errors — real data: 4 circular deps incl. playground fixtures,
  432 unused exports, 326 orphans; 386 warnings; 50 info). 6 unit tests
  (tests/runDoctor.test.ts); tsc 0, eslint 0, vitest 202/202. Not
  visually verified in a real browser (standard gap).

## 2026-08-14 — FilesPanel real file tree (last workspace placeholder resolved)

**Status:** Done

FilesPanel (was "file browser coming soon") now renders the interactive
file tree: POST /api/analyze's server-side `folderTree` (buildFolderGraph,
added in the Overview work) → ProjectStructure. Selection is lifted to
Workspace's `selectedModuleId` (shared with ImpactPanel) — clicking a
file in the tree drives the Impact tab, same as WorkspaceSearch.
Cost note: triggers a full clone+index per call, consistent with the
other panels (no caching yet). Verified: /workspace page HTTP 200 on a
dev server, no errors; tsc 0, eslint 0, vitest 202/202. Not visually
verified in a real browser (standard gap).

## 2026-08-14 — Branch switcher (workspace; last WorkspaceSwitcher gap)

**Status:** Done

- `packages/git/getBranches.ts` + `detectDefaultBranch.ts` implemented
  (both were 8-line stubs): `git ls-remote --heads` / `--symref HEAD`
  via execFileSync array args (no shell, no injection — same pattern as
  KI-010).
- `GET /api/branches?repoUrl=` (new route): `{ branches, defaultBranch
  }` — lightweight, never clones.
- WorkspaceSwitcher: branch section in the dropdown (list from
  /api/branches, current branch checkmarked); seeds the active branch
  from the repo default when none is set. Workspace owns `activeBranch`
  state and passes it to FilesPanel/ImpactPanel/IssuesPanel — panels
  refetch when it changes.
- Verified live: /api/branches on ARCLUX → 200 with the real branch
  list; missing-repoUrl → 400; /workspace 200, no errors. tsc 0,
  eslint 0, vitest 202/202. Not visually verified in a real browser
  (standard gap).

## 2026-08-14 — Activity page: commit history + contributors (/api/history)

**Status:** Done

- `cloneRepository` supports full clones now: `depth: 0` means no
  `--depth` flag (the arg was previously unconditional, so a full clone
  wasn't expressible). Documented on CloneOptions + the git-history
  helpers' comments.
- `GET /api/history?repoUrl=&maxCount=&branch=` (new route): full clone
  (depth 0) → getCommitHistory + getContributors → cleanup; returns
  `{ repoUrl, defaultBranch, commits, contributors }`. maxCount capped
  1..100 (default 50).
- `/[org]/[repo]/activity` page (new) renders ActivityView: recent
  commits (short hash, date, author, message) + contributors sorted by
  commit count; Sidebar gained an Activity link.
- Verified live: /api/history on ARCLUX → 200, 5 commits (maxCount=5,
  latest = the #336 merge), 6 contributors (top: GSF-001, 307);
  /activity page 200, no errors. tsc 0, eslint 0, vitest 208/208. Not
  visually verified in a real browser (standard gap).

## 2026-08-14 — Universal Responsive UI (mobile-first, Termux-friendly)

**Status:** Done (tsc 0, eslint 0, vitest 295/295, dev-server live: 6/6
pages HTTP 200, SSR HTML contains all new chrome). Visual pass on an
actual phone still pending (Mikatoshi).

- `hooks/useBreakpoint.ts` (new): { isMobile, isTablet, isDesktop }
  over the existing useMediaQuery wrapper (issue #147: re-export, not
  reimplementation). Breakpoints match Tailwind defaults (md=48rem,
  lg=64rem). Visibility itself is Tailwind-class driven (hydration-safe);
  the hook only feeds interactive behavior.
- `components/layout/BottomNav.tsx` (new): mobile-only (<md) 5-tab bar
  (Overview/Graph/Search/Activity/Workspace) as a flex child of the
  layout (not `fixed` — never overlaps content or the graph canvas),
  safe-area padding for notched phones, active tab highlight, 44px+
  targets.
- `Sidebar.tsx`: desktop `w-64` collapsible to a `w-16` icon rail
  (`transition-all duration-300`); tablet overlay mode (`overlay` +
  onClose); mobile hidden (BottomNav owns nav). Premium: `bg-sidebar`
  token + shadow, no `border-r`.
- `Navbar.tsx`: org/repo props; menu button (tablet opens overlay,
  desktop collapses sidebar — decided via useBreakpoint); Settings link
  visible only <md (it lives in the sidebar on larger screens); icon
  buttons `size-11 md:size-8` (44px touch target on mobile); no
  `border-b`.
- `WorkspaceLayout.tsx`: now "use client" with sidebar collapse state +
  overlay drawer (always mounted, CSS-hidden on lg+ so resizing to
  desktop mid-gesture is safe). Breadcrumbs strip uses `bg-muted/40`
  instead of `border-b`.
- `GraphCanvas.tsx`: native pinch-to-zoom (two-pointer distance ratio,
  zoom-to-midpoint), single-finger pan fallback after lifting one
  finger, `touch-none` on the canvas container (no browser scroll
  hijack), viewport culling for nodes AND edges (selected/hovered always
  render; CULL_MARGIN=100 world units), coarse-pointer hit radius
  (44px) via `(pointer: coarse)` media query.
- `GraphNode.tsx`: optional invisible hit-area circle (22px radius) for
  coarse pointers — visual 6px dot still meets the 44px tap target;
  rendered last so it sits on top (other shapes are pointer-events-none).
- `GraphEdge.tsx`: memoized (props stable across pan/zoom frames — same
  reasoning as GraphNode memo).
- `GraphViewport.tsx` ExplorerPanel: <md becomes a full-screen overlay
  (a 380px flex sibling would leave the canvas ~0px on a phone); md+
  keeps the 380px sibling. Branches on useMediaQuery — safe because the
  panel only mounts after a client-side node selection.
- `GlobalSearch.tsx`: results list `border` → `bg-card shadow-lg`,
  taller tap targets.
- No new npm dependencies (pinch is native Pointer Events; verified
  @use-gesture/react v10.3.1 is 2 years stale with unconfirmed React 19
  compat).
- Doc contradiction fixed (§4.9): `theme/arclux.json` referenced in 7
  places but never existed — all updated to theme/colors.ts +
  theme/theme.dark.ts (KI-030).
- Pre-existing build blocker found (not touched, out of scope):
  app/api/diagnostics/route.ts scaffold has no exports → `next build`
  fails its type-check on the generated route type (KI-029).

Verified: `cd apps/web && npx tsc --noEmit` 0; `pnpm --filter web lint`
0; `pnpm test` 295/295; `pnpm --filter web build` compiles but fails
final type-check on KI-029 only; dev-server: /test/test + graph/search/
workspace/activity/settings all HTTP 200, SSR HTML contains
Toggle-navigation / aria-label=Primary / bg-sidebar markers, no
console errors. Not visually verified on a real phone (standard gap).

## 2026-08-14 — Glassmorphism UI polish (1/3) + KI-029 systemic build fix

**Status:** Done (tsc 0, eslint 0, vitest 295/295, `next build` now
PASSES — previously failed on the scaffold routes, dev-server 6/6 pages
200). PR #363.

- Glass utilities in `app/globals.css` (`@layer components`):
  `.glass-panel` (bg-background/60 + blur-md + shadow-2xl),
  `.glass-overlay` (bg-background/80 + blur-lg), `.glass-card`
  (bg-background/40 + blur-sm, hover→/50), `.glass-topbar`
  (bg-background/70 + blur-md, applied on scroll). Colors go through
  theme tokens (bg-background / border-foreground) instead of the
  hardcoded zinc from the request — equivalent effect in dark mode
  (#000 background), and the light theme keeps working.
- Applied (chrome only, Mikatoshi's "1/3"): Sidebar inline
  (glass-panel) + overlay drawer (glass-overlay), BottomNav
  (glass-overlay), Navbar (glass-topbar when content scrollTop > 10px —
  scroll listener lives on the overflow-auto container in
  WorkspaceLayout, not window), RepositoryInfo stat cards + ActivityView
  commit/contributor cards (glass-card, border/neutral hardcodes
  replaced with tokens), GraphFocusView + GraphContextMenu + CommandPalette
  (glass-panel). NOT applied: graph canvas (solid black, perf), code
  blocks/FileDetails, search result list (readability).
- Performance guards (in globals.css): `@media (max-width: 768px)` →
  backdrop-filter blur(4px); `prefers-reduced-motion` → backdrop-filter
  none + solid `var(--background)`.
- KI-029 systemic: `next build` type-check failure was NOT one scaffold
  but six — app/api/{diagnostics,editor,notifications,processes,runtime,
  services}/route.ts were 8-line stubs with no exports. All six now
  export valid GET handlers returning explicitly-empty 200 JSON (honest
  "nothing reported yet" semantics documented in each file; NOT faking a
  scan). `next build` passes end-to-end.
- Shipping note: PR #362 (responsive UI) was merged while this work was
  in flight — the glass commit was pushed to the already-merged branch,
  so it was re-based as a fresh branch (feat/glass-ki029) off the
  updated ARCLUX.main and opened as PR #363.

## 2026-08-15 — Inline diagnostic gutter markers in FileDetails (line-level, not just file-level impact)

**Status:** Done

FileDetails.tsx previously rendered source as flat token-highlighted <pre> with no way to see WHICH line a diagnostic finding referred to -- Impact tab only showed affected FILES, not line-level detail. Rewrote to render per-line: each line gets a gutter (colored bar for error/warning severity + line number), clicking a marked line expands the diagnostic message + fix suggestion inline, editor-style. Explorer.tsx now fetches POST /api/diagnostics once per repoUrl/branch (not per file switch -- endpoint does full clone+index per call, same cost as /api/analyze) and filters events client-side to the open file's path, passed to FileDetails as a diagnostics prop. See PR #389.

## 2026-08-15 — Fixed gutter marker bugs found via browser testing

**Status:** Done

PR #389's inline gutter markers had 2 bugs caught by actual browser testing (screenshots): React key collision when the same checkId fires twice on one line (fixed: key is now checkId+index), and markers were nearly invisible (thin 2px bar only -- changed to whole-row background tint at 10% opacity + thicker bar). Confirmed working visually: cyclicA.ts/cyclicB.ts (express-demo) show 2-3 circular dependency findings with expandable messages. See PR #391.

## 2026-08-15 — Collapsible project structure tree in RepositoryOverview

**Status:** Done

Added a chevron toggle button (only visible once a file is selected) between the project tree and Explorer panel. Collapsing the tree expands Explorer to full width instead of a fixed 45%, so File/Dependencies/Impact tabs aren't cramped. Requested after visual testing showed the tree taking up too much space when viewing file diagnostics. See PR #393.

## 2026-08-15 — Syntax highlighting extended to JS/TS (was Python-only)

**Status:** In Progress

Added packages/parser/javascript/highlightJs.ts using the same walk-up-from-cwd wasm loading pattern as highlightPython.ts, with query merged from official tree-sitter-javascript + tree-sitter-typescript highlights.scm files. Wired into /api/file/route.ts. Still Go/Java/other languages -- tree-sitter-wasms has grammars for go.wasm, java.wasm, etc (confirmed present), but each needs its own highlights.scm sourced from that language's official tree-sitter grammar repo before highlighting can be added -- same process as this PR, just not done yet for those languages. Not yet visually verified in browser for JS/TS either. See PR #395.

## 2026-08-15 — Add docs page for SKILL.md

**Status:** Done

docs-site/skill.mdx added under Getting Started: points to SKILL.md on GitHub, summarizes what it covers, one example command. Registered in docs.json nav.

## 2026-08-16 — 3D graph view added

**Status:** In Progress

New GraphCanvas3D.tsx using react-force-graph-3d (Three.js/WebGL, d3-force-3d physics). Toggle button added to GraphViewport.tsx to switch between 2D (existing custom d3-force canvas) and 3D view. Reuses same DependencyGraph data from GraphProvider context, no changes to data pipeline. Not yet visually tested end-to-end.
