# ARCLUX Progress — Design Decisions

Why things were built the way they were. See PROGRES.md for the index.

## 2026-08-03 — Update — GitHub infra + features/graph decision

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


## 2026-08-03 — Update — parseTsx.ts and parseTsConfig.ts confirmed intentionally empty

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

## 2026-08-04 — Update -- PLANNED (not yet built): graph node visual impact indicator

> **[STATUS UPDATE, 2026-08-07]: this plan is now implemented.** See the
> "UPDATE: Graph impact halo — implemented" entry near the bottom of this
> file for what actually got built and what's still open (tier thresholds
> not yet tuned, not yet visually verified). The plan below is kept as-is
> for historical context -- don't re-implement it.

**Goal**: in the dependency graph view, high-impact nodes (files with
many consumers, e.g. logService.ts in a VS Code-scale repo with 430
importers) should be visually distinguishable WITHOUT clicking each node
first. Motivated by dogfooding: currently every file node is the same
blue regardless of impact, so finding "the important files" requires
clicking through hundreds of nodes one at a time.

**Explicit non-goal, confirmed with user**: do NOT change node color by
type. graphNodeColors (theme/graphColors.ts) currently colors nodes by
GraphNodeType (file=blue, external-package=amber, route=purple,
component=teal, hook=red) -- that must stay as-is, it's how users tell
node kinds apart. Impact must be a SEPARATE visual signal layered on top
(halo ring and/or radius size), not a replacement for type color.

**Data availability, already confirmed**:
- packages/shared/types.ts's GraphNode interface has NO importedBy/fan-in
  field built in.
- BUT DependencyGraph.edges (GraphEdge[], with source/target as GraphNode
  ids) is already sent to the browser in full via GET /api/graph
  (packages/graph/serializeGraph.ts passes graph.edges through
  unmodified, no changes needed there).
- Therefore: fan-in count per node can be computed CLIENT-SIDE by
  counting how many times each node id appears as an edge's `target`
  across graph.edges. No backend/API changes needed at all -- this is a
  frontend-only feature.

**Implementation plan, in order**:

1. In `apps/web/components/graph/GraphProvider.tsx`: add a `useMemo`
   that, whenever `graph` changes, builds `Map<nodeId, number>` by
   iterating `graph.edges` and counting occurrences of each `edge.target`.
   Expose this as a new `importCounts: Map<string, number>` field on
   `GraphContextValue` (add to both the interface and the `value` object
   near the bottom of the file, same pattern as the existing `positions`
   field).

2. In `apps/web/components/graph/GraphCanvas.tsx`: at the `<GraphNode>`
   render call around line 308-315 (confirmed exact location -- inside
   `{graph.nodes.map((node) => { ... return <GraphNode ... /> })}`,
   sibling props to `isSelected`/`isHovered`), pull `importCounts` from
   `useGraphContext()` (already imported/used elsewhere in this file
   presumably -- verify) and pass
   `importCount={importCounts.get(node.id) ?? 0}` as a new prop.

3. In `apps/web/components/graph/GraphNode.tsx`: add `importCount: number`
   to `GraphNodeProps`. Define tier thresholds (user's suggested starting
   point: High >100, Medium 20-100, Low/normal <20 -- these are
   arbitrary and should be tuned after seeing it rendered against a few
   real repos of different sizes, e.g. python-demo vs vscode vs next.js,
   since "100 importers" means very different things in a 50-file repo
   vs a 15,000-file repo). For High/Medium tiers, render an additional
   `<circle>` halo BEHIND the existing node circle (larger radius, no
   fill, a neutral stroke color like white or amber at low opacity --
   NOT reusing graphNodeColors, since that would collide with the
   type-color meaning). Consider also scaling BASE_RADIUS slightly for
   High-tier nodes. Existing isSelected halo logic
   (`{isSelected && <circle r={radius + 5} ... />}`) is a useful
   reference for the halo-circle pattern already used in this file --
   don't duplicate logic, structure the new halo consistently with it.

4. Test with `enableMouseInteraction`-style verification: run against
   playground/python-demo first (small, fast iteration) to confirm no
   crash/visual regression, THEN test against a large real repo (the
   user has already tested vscode, react, vercel/next.js, microsoft/vscode
   via the /new flow against localhost -- reuse one of those) to confirm
   the tiering actually looks meaningful at scale, not just correct in
   theory. Screenshot verification in-browser required before considering
   this done -- typecheck alone is not sufficient evidence per this
   project's established verification standard.

5. Consider whether label text position (`x={radius + 6}` in
   GraphNode.tsx) needs to account for the halo radius too, or if it's
   fine referencing only the inner circle's radius -- check visually.

6. Consider whether d3-force's collision detection (GraphCanvas.tsx,
   look for wherever simulation nodes get a radius/collision force) needs
   updating so bigger high-impact nodes don't visually overlap
   neighboring nodes now that some nodes are bigger than others -- this
   wasn't investigated yet, flagged as a real risk worth checking, not
   confirmed either way.

**Status**: planning/investigation only, ZERO code written yet. All file
line numbers and current-state details above were confirmed by directly
reading the files in this session -- safe to trust and start straight
from step 1 above without re-investigating from scratch.

## 2026-08-05 — Decision — same-package/same-namespace resolution: ONE generic pass, not per-language fixes

**Context**: Go graph (Kubernetes test) and Java graph (java-demo fixture)
both showed near-zero edges despite files clearly being related. Root
cause confirmed identical in both `parseGo.ts` and `parseJava.ts`'s own
comments (already documented by whoever wrote them, not discovered fresh
here): both Go and Java let files in the same package/directory reference
each other with ZERO import statements. `playground/go-demo`'s
cyclic_a.go/cyclic_b.go and `playground/java-demo`'s Main.java calling
Service/Models/Utils are both confirmed real examples of this. The parser
only extracts what's literally written, so these relationships never
reach `resolvePath.ts` as anything to resolve — there's no import
statement token to feed it in the first place.

**Decision**: do NOT write a Java-specific fix and a separate Go-specific
fix. This is one general problem — "files that share an implicit scope
need a same-scope dependency pass independent of import statements" —
that will likely also apply to C# (`namespace`) and Rust (`mod`) once
those parsers go further than manifest-only (`parseCsproj.ts`,
`parseCargoToml.ts` exist; `parseCSharp.ts`/`parseRust.ts` are still
empty). Build ONE resolution pass parameterized by "what counts as a
shared scope" per language (directory for Go, package declaration for
Java), not four copies of similar logic.

**Not yet built** — this is a design decision recorded for whoever picks
this up next, not an implementation. Same class of gap as
`resolveRoutes.ts` being empty (noted in parseGo.ts's own comment as a
parallel case).

**Referenced but not portable**: cloned `javaparser/javaparser` to
`~/research/javaparser` for its `SymbolSolver`/`TypeSolver` concepts —
it's a JVM library, not directly adaptable to TypeScript, but worth
reading for how a mature tool structures scope resolution before
designing ARCLUX's own pass.

## 2026-08-06 — Decision — issues assigned to a collaborator must also be marked in-file

**Context**: packages/parser/php/parsePhp.ts and
packages/parser/php/parsePhpRoutes.ts sit right next to each other.
parsePhpRoutes.ts is assigned to Alitindrawan24 via issue #53.
Someone Browse-ing packages/parser/php/ without first checking the
GitHub issues list has no way to know parsePhpRoutes.ts is spoken for
- it just looks like another empty file waiting to be filled in,
identical in appearance to a genuinely unclaimed stub.

**Decision**: whenever an issue is filed that assigns a SPECIFIC file
or narrowly-scoped task to a collaborator, also add a short comment in
that file (or, if the file doesn't exist yet, in the most relevant
existing sibling file) stating the issue number and assignee. Do not
rely on the GitHub issue tracker alone to communicate this - anyone
working directly in the codebase (a session reading files, not
Browse-ing issues first) needs the signal to be visible at the file
level too.

Minimum content for the marker comment: issue number, assignee
username, one line on what's being built there. See
packages/parser/php/parsePhp.ts's comment (referencing issue #53 /
Alitindrawan24 / parsePhpRoutes.ts) as the template to follow.

This does not replace filing the GitHub issue - both are required, the
file comment is an addition for discoverability, not a substitute.

## Still empty, priority order for next session

1. `packages/indexer/resolveRoutes.ts` — unblocks entry-file-awareness for detectUnusedExports/detectOrphanFiles false positives
2. `packages/indexer/resolveExports.ts`, `resolveComponents.ts`, `resolveHooks.ts`, `resolveProviders.ts` — same family as resolveRoutes
3. `apps/web/components/explorer/Explorer.tsx`, `DependencyList.tsx` — FileDetails.tsx already exists but isn't wired to anything, this is why
4. `apps/web/lib/api.ts`, `graph.ts` — client fetch helpers, currently pages call fetch() inline
5. `packages/db/*` — persistence layer, 0%, needed before any "history over time" feature
6. `packages/indexer/updateIndex.ts`, `watchIndex.ts`, `indexSchema.ts` — incremental indexing, depends on packages/incremental being wired in first (not yet done)

## 2026-08-07 — DependencyList.tsx type confirmed against real API

DependencyList.tsx previously had a local GraphResponse/GraphNodeResponse/GraphEdgeResponse type, written before app/api/graph/route.ts's actual response shape was checked (its own comment admitted this). Verified: DependencyGraph.nodes/edges from packages/shared/types match exactly. Replaced the local guessed type with the real shared type. Going forward: don't guess API response shapes in component files -- check the actual route.ts handler first, even if it means a short delay before writing the component.

## 2026-08-07 — Next steps priority for future sessions

> **[STATUS UPDATE, 2026-08-07 later same day]: item (1) below is now
> implemented** -- see "UPDATE: Graph impact halo — implemented" near
> the end of this file. Item (2) is still open.

Two concrete next steps identified this session, in suggested order: (1) Graph node visual impact indicator (halo ring for high-fan-in nodes) -- full implementation plan already documented in an earlier entry in this file (client-side importCounts via useMemo in GraphProvider.tsx, passed as importCount prop through GraphCanvas.tsx to GraphNode.tsx, rendered as an extra halo circle). Zero code written yet, ready to start from step 1. (2) Remaining inline fetch() calls that duplicate the pattern lib/api.ts's fetchJson() now centralizes -- ImpactSummary.tsx and GlobalSearch.tsx were the two examples that motivated building fetchJson() in the first place but were NOT themselves refactored to use it. Worth a follow-up pass to actually consume the helper there, plus check FileDetails.tsx and app/api/file/route.ts for the same duplicated pattern.

## 2026-08-07 — Graph impact halo: zoom-gated to avoid clutter

Resolved an open question from the original halo-ring plan: halos only render when zoom level is past a threshold (not always-on), avoiding visual clutter/overlap when zoomed out on dense graphs. Rejected alternatives: always-on halo (overlaps neighboring nodes in dense graphs), thicker border/stroke instead of halo (loses the 'grows with importance' visual cue that a halo radius gives). Implementation-wise this means GraphNode.tsx's halo render needs access to the current transform.scale (already available via useGraphContext()) and a MIN_ZOOM_FOR_HALO constant to gate on.

## 2026-08-07 — UPDATE: Graph impact halo — implemented

The halo-ring plan described in the 2026-08-0X entry above (and listed as a next step in 'Next steps priority for future sessions') is now implemented: GraphNode.tsx renders an impact halo circle gated by zoomScale >= MIN_ZOOM_FOR_HALO, importCount computed via useMemo in GraphProvider.tsx from graph.edges, passed through GraphCanvas.tsx. Tier thresholds (High >100, Medium 20-100) are still unverified against real repos -- that part of the original plan remains open. Not yet visually verified in-browser as of this entry. If you're reading the older halo entries above, they're outdated -- this is the current status.

## 2026-08-07 — Simulated stage progress instead of real backend streaming

`apps/web/components/graph/AnalyzingProgress.tsx` (new) replaces the
static "Analyzing repository…" text in GraphCanvas.tsx's `isLoading`
branch. Cycles through 5 stage labels (Cloning/Scanning/Parsing/
Resolving/Building) on a fixed timer + shows an indeterminate progress
bar, with a "taking longer than usual" message after ~17s.

**Chose client-only simulated progress over backend SSE streaming**:
the correct fix (backend emits real stage events, e.g. via
Server-Sent Events on /api/graph) would need analyzeRepository()'s
pipeline to become event-emitting instead of a single synchronous
return — a much larger change. This is a stopgap: the labels/timing are
tuned by feel, NOT derived from real pipeline telemetry. Large repos will
sit on the last stage indefinitely since there's no real signal to
advance further. Documented as such in the component's own comment so
nobody later mistakes this for actual progress reporting.

Addresses the UX gap noted in status-backlog.md's large-repo dogfooding
entry (microsoft/TypeScript's "Indexing failed" was indistinguishable
from vercel/next.js's "just slow" until it errored, because there was no
feedback at all).

Verified: `tsc --noEmit -p apps/web/tsconfig.json` clean. NOT yet
visually verified in-browser — pushed near a chat context limit.

**Coordination note**: `git pull` before this session started fast-forwarded
in unrelated changes to GraphCanvas.tsx/GraphNode.tsx/GraphProvider.tsx
from another session (fan-in halo indicator feature, matches an earlier
decisions.md plan) — merged cleanly, no conflict with this change since
they touch different parts of the same files.

## 2026-08-07 — QUICKSTART.md language kept English

QUICKSTART.md initially drafted in Indonesian during a mobile terminal session, per user preference for chat interaction. Decided to keep it English-only to match PROGRES.md and TOOLING.md conventions (all repo docs are English, Indonesian is only used in Claude chat sessions). No translation needed yet since the file is still short (3 sections: workflow, progress logging, pre-check for empty files).

## 2026-08-07 — README Contributors section intentionally removed

The Contributors section (contrib.rocks avatar grid) was intentionally removed from README.md by the user via a direct GitHub browser edit. A later session mistook this for accidental damage (based on the generic 'Update README.md' commit message, which matched the pattern of other stray browser-edit branches like GSF-001-patch-1/-2) and restored it -- this was wrong and got reverted. If README.md is missing a Contributors section in the future, that's the current intended state, not a bug to fix.
