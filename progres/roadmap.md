# ARCLUX Roadmap

Long-term direction, separate from decisions.md (which is "why we
chose X over Y" for things already decided/done) and status-*.md
(current implementation status). This file is where we're headed.

## Core principle

ARCLUX stays a deterministic structural-truth engine — no AI/ML
inside core packages. See ARCHITECTURE_MAP.md for the enforced
boundary. Intelligence/semantic layers are welcome, but as a separate
consumer package, not woven into engine/parser/graph/detectors.

## Phase 0 — Reliability (in progress)

- Python parsing/edges silent-failure bugs (wasm path root cause found
  and fixed; some follow-up may still be needed by another session)
- General "does the pipeline actually work against large real repos"
  hardening

## Phase 1 — Structural search

Upgrade search from filename-matching (fuzzyScore.ts) to graph-aware:
a match should surface not just the file, but its structural context
(imports, exports, consumers, dependencies, affected routes) using
data ARCLUX already computes (buildDependencyGraph, impact/*).

## Phase 2 — Architecture health score

Aggregate the 18 existing detectors into a single health view instead
of a flat problem list: per-category scores (structural integrity,
dependency hygiene, layer consistency, dead code, convention
consistency) plus a ranked risk-areas list. Scores derived purely from
detector findings -- no AI, no subjective weighting invented from
nowhere.

## Phase 3 — Optional intelligence (not started, no urgency)

A new packages/intelligence/ package (see ARCHITECTURE_MAP.md) for
anyone who wants to build semantic search / RAG / embeddings on top
of ARCLUX's structural output. Not core team's priority -- open to
contributions here (e.g. from ManSio) but not being pursued
proactively.

## Phase 4 — External integrations (later, if ever)

LSP bridge, MCP/agent interface, IDE integration. Deliberately last --
bringing this in early risks blurring "who's the source of truth" for
the parse -> index -> graph -> impact -> detect pipeline.

## Vision items (no phase assigned, long-term)

- TUI (terminal UI) as a third consumer of engine/, alongside CLI and
  web. See decisions.md's TUI entry for the original discussion.
