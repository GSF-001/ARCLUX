# ARCLUX — Architecture Map

Not implementation, not a feature list — a boundary map. Read this
before adding anything new, especially if you're extending ARCLUX with
a new capability (search, intelligence layers, RAG, etc), not just
fixing/completing an existing stub.

## Layers
packages/
├── engine/       ← CORE — the orchestrator (analyzeRepository()).
│                    Changes here need a decisions.md entry first, not
│                    just a PR. This is the one file everything else
│                    depends on; breaking it breaks everything.
├── repository/   ← CORE — the domain model (Repository, ModuleInfo).
│                    Same rule as engine/: discuss before changing shape.
├── shared/       ← CORE — types.ts is the shape of everything else.
│                    Adding fields is usually fine; changing/removing
│                    existing ones needs a decisions.md entry.
├── parser/       ← EXTENSION POINT — new language support goes here,
│                    one subfolder per language, implementing
│                    LanguageParser. Safe to add to without discussion.
├── indexer/      ← CORE-ADJACENT — resolves imports into a Repository.
│                    New resolver passes (routes, components, etc) are
│                    fine to add; changing buildIndex.ts's pass order
│                    needs care, later passes depend on earlier ones.
├── graph/        ← CORE-ADJACENT — turns a Repository into a
│                    DependencyGraph. New graph VARIANTS (buildCallGraph,
│                    buildImportGraph) are extensions; changing
│                    buildDependencyGraph.ts's core shape is not.
├── detectors/    ← EXTENSION POINT — each detector is independent,
│                    takes a Repository, returns findings. Safe to add
│                    a new one without discussion (see
│                    detectAmbiguousSymbolResolution.ts for the pattern).
├── impact/       ← CORE-ADJACENT — consumer/dependent tracing.
├── cache/        ← EXTENSION POINT — additive by nature, a cache
│                    miss should always fall back to the uncached path.
├── search/       ← MOSTLY STUB — see progres/status-*.md for current
│                    state before assuming this is a place to add
│                    semantic search / embeddings / RAG. See "Where
│                    intelligence layers go" below.
├── watcher/,
├── incremental/  ← FOUNDATION, NOT WIRED IN YET — see decisions.md,
│                    don't build on top of these until they're
│                    actually connected to engine/pipeline.ts.
└── rules/        ← EXTENSION POINT — one subfolder per framework,
independent convention checks.
apps/
├── cli/          ← SURFACE — consumes engine/, no business logic here.
└── web/          ← SURFACE — consumes engine/ via API routes, no
business logic in components. Graph rendering
(SVG/d3-force) lives here, not in packages/graph/.
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
