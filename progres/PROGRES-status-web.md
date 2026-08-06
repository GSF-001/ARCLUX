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
- IssuesPanel.tsx: honest "coming soon" EmptyState, NOT fake detector
  data. Detectors themselves are 18/18 done and already run via `apps/cli
  doctor`, but nothing exposes them over HTTP yet -- needs a new
  /api/doctor route.

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

