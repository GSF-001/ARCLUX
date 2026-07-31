# Contributing to Arclux

Arclux is alpha software. The core model, graph builder, and TypeScript
parser work; most detectors, other language parsers, and the dashboard
do not exist yet. Expect breaking changes before 1.0.

## Setup

```bash
git clone https://github.com/GSF-001/ARCLUX.git
cd ARCLUX
pnpm install
pnpm test
```

Requires Node 20+ and pnpm. This is a `turbo` monorepo — run tasks from
the root, not inside individual packages, unless you're iterating on one
package in isolation.

## Structure

```
apps/cli        command-line interface
apps/web        Next.js dashboard
packages/       parser, graph, impact, detectors, rules, engine,
                indexer, search, watcher, git, db, cache
```

Each stage in `repository → parser → graph → detectors → engine → report`
is an independent package. Don't reach across stages directly — go
through the public entry point of the package you need.

## Before opening a PR

- Check `packages/*` for an existing file that does what you're about to
  write. Overlapping implementations of the same responsibility have
  happened before and are the main source of dead code in this repo.
- Run `pnpm test` and `pnpm typecheck` locally.
- Keep PRs scoped to one package or one concern. Cross-cutting changes
  are harder to review and more likely to hide a duplicate.

## Adding a detector

Detectors live in `packages/detectors/`. Each one should:
- Take the built graph as input, not re-parse files itself
- Return a flat list of findings with file path, message, and severity
- Have a corresponding test in `tests/`

## Adding a language parser

Parsers live in `packages/parser/<language>/`. Follow the shape of the
existing TypeScript parser — same output format for imports, exports,
and symbols, so downstream packages don't need per-language branching.

## Adding a framework rule

Rules live in `packages/rules/<framework>/` and are built on
`RuleEngine.ts`. A rule is a predicate over the graph plus a message; it
should not know about file I/O.

## Commit messages

Conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
Keep the subject line under 72 characters.

## Reporting bugs

Open an issue with the repository you ran Arclux against (if public),
the command you ran, and the actual vs. expected output. A minimal
reproduction is more useful than a full log.
