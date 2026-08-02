# Arclux

Dependency graph, impact analysis, and structural linting for your codebase. CLI + web dashboard.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-black)](LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-black)](#status)

## What it does

- Builds a dependency graph (imports, exports, calls, folders) from static analysis
- Traces impact — what breaks if you change file X
- Detects circular deps, dead code, orphan files, duplicate modules, layer violations
- Enforces framework conventions for Next.js, React, NestJS, Express, Vite, Electron
- Parses TypeScript, JavaScript, Python, Go, Rust, Java, C#, C++, PHP, Ruby

## Install

```bash
pnpm add -g arclux
```

## Usage

```bash
arclux analyze .              # full repository analysis
arclux graph .                # generate dependency graph
arclux impact <file>          # trace consumers of a file
arclux doctor                 # check conventions
arclux dashboard               # launch web UI
```

```
$ arclux analyze .
1,204 files · 312 modules · 847ms
3 circular deps · 12 unused exports · 3 layer violations
```

## How it works

```
repository → parser → graph → detectors → engine → report
                          ↳ rules (framework conventions)
```

Each stage is an independent package: `parser`, `graph`, `impact`, `detectors`, `rules`, `engine`.

## Structure

```
apps/cli        command-line interface
apps/web        Next.js dashboard
packages/       parser, graph, impact, detectors, rules, engine, indexer, search, watcher, git, db, cache
```

## Status

Alpha. Core model, graph builder, and TypeScript parser are working. Other language parsers, the detector suite, and the dashboard are in progress. Expect breaking changes pre-1.0.

## Contributing

```bash
git clone https://github.com/<org>/arclux.git
cd arclux && pnpm install && pnpm test
```

PRs welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Apache License 2.0 © Arclux Contributors
