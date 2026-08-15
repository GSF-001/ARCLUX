---
name: arclux
description: Use ARCLUX's CLI to understand codebase structure, check impact before editing, and catch structural issues (circular dependencies, dead code, ambiguous symbols) before shipping changes in this repository.
---

# ARCLUX

This repository ships its own codebase intelligence CLI (arclux). Use it instead of guessing about dependency structure, blast radius, or code health from reading files alone.

## When to use which command

Before editing a file -- check what depends on it, so you know the blast radius before you touch it:
```bash
npx tsx apps/cli/index.ts impact <path/to/file>
```

After editing files -- check for new structural issues introduced by the change:
```bash
npx tsx apps/cli/index.ts diagnose [path]
```
Reports circular dependencies, dead code, and ambiguous symbol resolution, each with impact context (how many files are affected) and a fix suggestion. Defaults to the current directory if path is omitted.

Before opening a PR or finishing a task -- run the full detector suite for a single PASS/FAIL verdict:
```bash
npx tsx apps/cli/index.ts verify [path]
```

Applying a change programmatically (not manual file edits) -- go through the Change Pipeline instead of writing the file directly, so writes are transactional and recoverable on crash:
```bash
npx tsx apps/cli/commands/work.ts <file> <newContentFile>
```

Understanding a file or module before working on it:
```bash
npx tsx apps/cli/index.ts graph [path]        # dependency graph, prints or saves JSON
npx tsx apps/cli/index.ts language <file>     # exports/imports/calls for a single file
npx tsx apps/cli/index.ts analyze [path]      # full parse + index + graph build
```

Comparing two states (e.g. before/after a refactor, or two git refs):
```bash
npx tsx apps/cli/index.ts diff <refA> <refB> [repoPath]
```

## Environment gotchas (see progres/gotchas.md and progres/bugs.md for the full list)

- Running on Termux (Android) arm64: apps/web uses Webpack, not Turbopack -- don't add --turbo to dev scripts.
- diagnose previously crashed with heap-out-of-memory on large repos (~1000 modules); root cause was fixed in packages/diagnostics/ErrorContext.ts (getImpactCount() replaced retaining full impact trees for every finding). Should no longer need NODE_OPTIONS=--max-old-space-size for typical repos -- if it still OOMs, that's a regression worth reporting, not an expected workaround.
- Python parsing depends on tree-sitter-wasms; do NOT reintroduce require.resolve() for locating the .wasm file inside packages/parser/python/parsePython.ts -- this has regressed 3 times already (progres/bugs.md, most recently 2026-08-15). Always walk up from process.cwd() instead.

## Don't

- Don't hand-edit progres/PROGRES-*.md files -- use scripts/log-progress.sh (see TOOLING.md).
- Don't add a new top-level intelligence/search/RAG capability inside packages/engine, packages/graph, or packages/detectors -- see ARCHITECTURE_MAP.md's "Where intelligence layers go" section. New capabilities in that direction belong in a new top-level package consuming ARCLUX's stable outputs, not woven into core.
- Don't assume ARCLUX.main and main are the same branch -- they have diverged before. Always git pull origin ARCLUX.main.
