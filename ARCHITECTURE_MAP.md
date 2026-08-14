# ARCLUX — Architecture Map

Not implementation, not a feature list — a boundary map. Read this
before adding anything new, especially if you're extending ARCLUX with
a new capability (search, intelligence layers, RAG, etc), not just
fixing/completing an existing stub.

## Layers

### packages/ — CORE (changes need a decisions.md entry first)

- `engine/` — the orchestrator (`analyzeRepository()`). Everything else depends on this.
- `repository/` — the domain model (`Repository`, `ModuleInfo`).
- `shared/` — `types.ts` is the shape of everything. Adding fields is fine; changing/removing needs a decisions.md entry.

### packages/ — CORE-ADJACENT (care needed, but not a full stop)

- `indexer/` — resolves imports into a `Repository`. New resolver passes (routes, components, etc) are fine to add. Changing `buildIndex.ts`'s pass order needs care — later passes depend on earlier ones.
- `graph/` — turns a `Repository` into a `DependencyGraph`. New graph variants (`buildCallGraph`, `buildImportGraph`) are extensions. Changing `buildDependencyGraph.ts`'s core shape is not.
- `impact/` — consumer/dependent tracing.

### packages/ — EXTENSION POINTS (safe to add to without discussion)

- `parser/` — new language support, one subfolder per language, implements `LanguageParser`.
- `detectors/` — each detector is independent, takes a `Repository`, returns findings. See `detectAmbiguousSymbolResolution.ts` for the pattern.
- `cache/` — additive by nature. A cache miss should always fall back to the uncached path.
- `rules/` — one subfolder per framework, independent convention checks.

### packages/ — MOSTLY STUB

- `search/` — core engine done (issue #9): `SearchIndex`, `SearchEngine`
  (fuzzyScore ranking over paths + export names), `SearchFilters`;
  `SearchProvider`/`SearchResults`/`SearchKeyboard` are plain-TS
  session/type/shortcut helpers (packages are framework-agnostic — React
  wiring lives in `apps/web`). Consumed by `/api/search`.

### packages/ — FOUNDATION, BUILT BUT NOT WIRED INTO THE PIPELINE

- `watcher/`, `incremental/` — see `decisions.md`. `watchRepository`
  (coarse, change-level cache over `analyzeRepository({ localPath })`)
  is functional but has no consumer yet; `buildIndex` still does a full
  rebuild (per-file granular incrementality is deferred — issue #6,
  see decisions.md). Don't build new capabilities on top of these until
  a consumer exists.

### apps/ — SURFACES (consume packages/, no business logic here)

- `cli/` — consumes `engine/`.
- `web/` — consumes `engine/` via API routes. Graph rendering (SVG/d3-force) lives here, not in `packages/graph/`.

## Where intelligence/AI layers go

ARCLUX's job is building an accurate STRUCTURAL model of a codebase:
parse → index → graph → impact → detect. It is deliberately NOT trying
to be a semantic search engine, a RAG system, an agent-facing MCP
server, or an embeddings/reranking pipeline — those are different,
legitimate problems, but they are consumers of a structural model, not
part of building one.

If you're adding something in that direction (semantic search, graph
RAG, agent tool-calling, embeddings, LSP bridging, experiment
tracking, self-healing/autonomous-fix behavior): it belongs in a NEW
top-level package (e.g. `packages/intelligence/`), consuming
`DependencyGraph`/`Repository`/`AnalyzeRepositoryResult` as inputs —
not woven into `graph/`, `detectors/`, or `engine/`. Treat ARCLUX the
way you'd treat a library you don't maintain: depend on its stable
outputs, don't reach into its internals.

This boundary exists on purpose, based on comparing notes with a
collaborator (ManSio) who maintains a much more elaborate
codebase-intelligence system (mscodebase-intelligence: graph RAG,
agentic search, embeddings, LSP bridge, sandboxing, 1000+ tests). That
project is a good example of what a consumer built ON TOP of a
structural model like ARCLUX's could look like — not a template for
what ARCLUX's own core should become. Keeping the boundary explicit
means ARCLUX stays the thing that's verified against real large repos
and has a clear job, rather than slowly absorbing every interesting
idea a skilled collaborator brings and losing that discipline.

## Definition of "done" for anything non-trivial

Not done until all five:
1. **Implemented** — the code exists and typechecks
2. **Tested** — verified against a real fixture or repo, not just
   `tsc --noEmit` (see TOOLING.md's verification standard)
3. **Integrated** — actually called from somewhere real (engine/
   pipeline.ts, a detector registry, an API route) — see
   progres/bugs.md's manifest-parser and cache entries for what
   "implemented but never wired in" costs if skipped
4. **Verified** — for anything touching apps/web, confirmed visually
   in-browser, not just assumed from code review
5. **Documented** — a progres/*.md entry exists (status, decision, or
   bug depending on what it is) — see TOOLING.md section 1

## Changing this file

This file describes boundaries, not the current implementation state
(that's what progres/status-*.md is for) and not package-by-package
descriptions (that's packages/README.md). If a layer's boundary
genuinely needs to move — not just "someone wants an exception" — log
the reasoning in decisions.md first, then update this file to match.
