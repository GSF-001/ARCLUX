# Contributing to ARCLUX

ARCLUX is alpha software (`v0.1.0-alpha`). The core pipeline, all 18
detectors, full impact analysis, and the CLI are working and verified.
Other-language parsers, the search engine, and several UI areas are still
stubs. Check `PROGRES.md` at the repo root for the current, detailed
status before assuming anything is done or missing — it's updated after
every milestone and is more accurate than this file for "is X done yet."

Expect breaking changes before 1.0.

## Setup

```bash
git clone https://github.com/GSF-001/ARCLUX.git
cd ARCLUX
pnpm install
```

Requires Node 20+. This is a pnpm workspaces monorepo (managed with
Turborepo) — most day-to-day work happens inside a specific `apps/*` or
`packages/*` directory, using that directory's own `package.json` scripts.

## Structure

```
apps/cli        command-line interface (analyze, doctor, graph, config, impact)
apps/web        Next.js dashboard
packages/       parser, graph, impact, detectors, rules, engine,
                indexer, search, watcher, git, db, cache, incremental,
                repository, shared
playground/     fixture repos (python-demo, nextjs-demo, react-demo, etc.)
                used for manual verification — see "Testing your changes"
scripts/        testPlayground.ts — runs the pipeline + all detectors
                against a playground/ fixture or any local path
```

Each stage in `repository → parser → graph → detectors → impact/engine`
is an independent package. Don't reach across stages directly in
production code paths (CLI commands, API routes) — go through
`packages/engine/pipeline.ts`'s `analyzeRepository()`. Calling steps
individually is only acceptable in local dev/test scripts (see
`scripts/testPlayground.ts` for the established pattern) — not in
anything that ships.

## Before opening a PR

- **Check for an existing implementation first.** Grep for the
  function/file name you're about to write. This project has had files
  implemented twice under different names by parallel sessions more than
  once — it's the single biggest source of wasted work here. `cat` a file
  before trusting its line count: a file with only the license header is
  8 lines, not 0 — see `PROGRES.md`'s note on this.
- **`tsc --noEmit` passing is not "verified."** Every detector and pipeline
  change in this repo has been tested against a real fixture in
  `playground/`, either via `npx tsx scripts/testPlayground.ts <fixture>`
  or `npx tsx apps/cli/index.ts doctor <path>`. A PR that only shows a
  clean typecheck for logic changes will likely get asked to add that.
- Keep PRs scoped to one package or one concern.
- Update `PROGRES.md` if your change completes something that was
  previously listed as a stub, or if you discover the status recorded
  there is stale (this happens — parallel sessions occasionally get out
  of sync with what's actually written).
- `main` requires a pull request — direct pushes are blocked by branch
  ruleset.

## Adding a detector

Detectors live in `packages/detectors/`. Look at `detectOrphanFiles.ts`
or `detectSharedModules.ts` for a simple example, or `detectUnusedExports.ts`
for one with documented known limitations. Each detector should:
- Take a `Repository` instance as input (not re-parse files itself)
- Return a flat array of typed findings (see the `*Finding` interface
  pattern used by existing detectors)
- Register in `apps/cli/doctor.ts` so it runs as part of `arclux doctor`
- If entry points matter for your detector's accuracy, use
  `detectEntryPoints.ts`'s output to filter false positives — several
  existing detectors don't do this yet and have documented false
  positives as a result; don't repeat that if you can avoid it

## Adding a language parser

Parsers live in `packages/parser/<language>/`. Follow the shape of
`parseTs.ts` (regex/AST-based) or `parsePython.ts` (tree-sitter-based) —
same output contract (`ParsedFile` with `imports`/`exports`), so
downstream packages don't need per-language branching. If using
tree-sitter, **read the gotchas in `PROGRES.md`'s Python parser section
first** (specific version pin required, WASM loading quirks) before
hitting the same issues again.

## Adapting code from other open-source projects

This is done deliberately and carefully in this repo (see `NOTICE` at
root for the full list — madge, knip, cmdk, tree-sitter-python, and
others). If you adapt an algorithm or pattern from elsewhere:
- Re-implement it against ARCLUX's own types — don't port line-by-line
  unless it's a verbatim copy for a good reason (e.g. a syntax-highlight
  query, which should stay byte-identical to upstream)
- Add attribution in both the file's header comment AND `NOTICE`
- Note explicitly, in a comment, what's different from the original and
  why

## Commit messages

Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
Keep the subject line under 72 characters.

## Reporting bugs

Open an issue using the Bug report template. Include the exact command
you ran and, if it's about parsing/detection, which file/repo triggered
it — a `playground/` fixture reproducing it is ideal but not required.
