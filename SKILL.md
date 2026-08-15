---
name: arclux
description: Use ARCLUX's CLI to understand codebase structure, check impact before editing, and catch structural issues (circular dependencies, dead code, ambiguous symbols) before shipping changes in this repository.
---

# ARCLUX

This repository ships its own codebase intelligence CLI (`arclux`). Use it instead of guessing about dependency structure, blast radius, or code health from reading files alone.

## When to use which command

**Before editing a file** -- check what depends on it, so you know the blast radius before you touch it:
```bash
npx tsx apps/cli/index.ts impact <path/to/file>
```

**After editing files** -- check for new structural issues introduced by the change:
```bash
npx tsx apps/cli/index.ts diagnose [path]
```
Reports circular dependencies, dead code, and ambiguous symbol resolution, each with impact context (how many files are affected) and a fix suggestion. Defaults to the current directory if `path` is omitted.

**Before opening a PR or finishing a task** -- run the full detector suite for a single PASS/FAIL verdict:
```bash
npx tsx apps/cli/index.ts verify [path]
```

**Applying a change programmatically** (not manual file edits) -- go through the Change Pipeline instead of writing the file directly, so writes are transactional and recoverable on crash:
```bash
npx tsx apps/cli/index.ts work <file> <newContentFile>
```

**Understanding a file or module before working on it:**
```bash
npx tsx apps/cli/index.ts graph [path]        # dependency graph, prints or saves JSON
npx tsx apps/cli/index.ts language <file>     # exports/imports/calls for a single file
npx tsx apps/cli/index.ts analyze [path]      # full parse + index + graph build
```

**Comparing two states** (e.g. before/after a refactor, or two git refs):
```bash
npx tsx apps/cli/index.ts diff <ref1> <ref2>
```

## Environment gotchas (see progres/gotchas.md for the full list)

- Running on Termux (Android) arm64: `apps/web` uses Webpack, not Turbopack -- don't add `--turbo` to dev scripts.
- Large repos (1000+ files) may need `NODE_OPTIONS="--max-old-space-size=4096"` for `diagnose` and similar commands.
- Python parsing depends on `tree-sitter-wasms`; do not reintroduce `require.resolve()` for locating the `.wasm` file inside `packages/parser/python/parsePython.ts` -- this has regressed multiple times (see `progres/bugs.md`, entries tagged "Python WASM path").

## Don't

- Don't hand-edit `progres/PROGRES-*.md` files -- use `scripts/log-progress.sh` (see `TOOLING.md`).
- Don't add a new top-level intelligence/search/RAG capability inside `packages/engine`, `packages/graph`, or `packages/detectors` -- see `ARCHITECTURE_MAP.md`'s "Where intelligence layers go" section. New capabilities in that direction belong in a new top-level package consuming ARCLUX's stable outputs, not woven into core.
