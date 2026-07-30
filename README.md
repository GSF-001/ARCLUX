# Aries

Architecture intelligence for your codebase. Aries builds a dependency graph of your repository, detects structural issues, and calculates the blast radius of any change — from the terminal or a web dashboard.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![Build with Turborepo](https://img.shields.io/badge/monorepo-turborepo-red.svg)](#)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)](#)
[![Status](https://img.shields.io/badge/status-early%20development-orange.svg)](#project-status)

---

## Table of Contents

- [Overview](#overview)
- [Project Status](#project-status)
- [Architecture](#architecture)
- [Repository Layout](#repository-layout)
- [Getting Started](#getting-started)
- [CLI](#cli)
- [Web Application](#web-application)
- [Language Support](#language-support)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Modern codebases grow faster than anyone's mental model of them. Aries exists to close that gap by parsing a repository into a structured graph — files, modules, exports, routes, components — and exposing that graph through analysis, search, and impact tooling.

Core capabilities:

- **Dependency graph** — import, export, call, and folder graphs built from static analysis
- **Impact analysis** — trace consumers and dependents of any file, module, or route before you change it
- **Structural detectors** — circular dependencies, dead code, orphan files, duplicate modules, layer violations, and more
- **Framework-aware rules** — conventions for Next.js, React, NestJS, Express, Vite, and Electron
- **Multi-language parsing** — a shared engine with parsers for TypeScript/JavaScript, Python, Go, Rust, Java, C#, C++, PHP, and Ruby

---

## Project Status

This project is under active, early-stage development. The full module layout is scaffolded, but implementation is landing incrementally — most files currently exist as empty placeholders reserving their intended API surface, while a smaller set already contains working logic.

Implemented so far (non-exhaustive):

**Core domain**
- [`packages/repository/File.ts`](packages/repository/File.ts)
- [`packages/repository/Folder.ts`](packages/repository/Folder.ts)
- [`packages/repository/Node.ts`](packages/repository/Node.ts)
- [`packages/repository/Edge.ts`](packages/repository/Edge.ts)
- [`packages/repository/Module.ts`](packages/repository/Module.ts)
- [`packages/repository/Repository.ts`](packages/repository/Repository.ts)
- [`packages/repository/Graph.ts`](packages/repository/Graph.ts)

**Parser core**
- [`packages/parser/core/ParserInterface.ts`](packages/parser/core/ParserInterface.ts)
- [`packages/parser/core/ParserRegistry.ts`](packages/parser/core/ParserRegistry.ts)
- [`packages/parser/core/scanFiles.ts`](packages/parser/core/scanFiles.ts)
- [`packages/parser/typescript/parseTs.ts`](packages/parser/typescript/parseTs.ts)

**Graph & indexing**
- [`packages/graph/buildDependencyGraph.ts`](packages/graph/buildDependencyGraph.ts)
- [`packages/graph/resolvePath.ts`](packages/graph/resolvePath.ts)
- [`packages/indexer/buildIndex.ts`](packages/indexer/buildIndex.ts)
- [`packages/indexer/resolveAliases.ts`](packages/indexer/resolveAliases.ts)

**Engine**
- [`packages/engine/pipeline.ts`](packages/engine/pipeline.ts)
- [`packages/engine/detectRepositoryMeta.ts`](packages/engine/detectRepositoryMeta.ts)

**Git & shared utilities**
- [`packages/git/cloneRepository.ts`](packages/git/cloneRepository.ts)
- [`packages/git/cleanupRepository.ts`](packages/git/cleanupRepository.ts)
- [`packages/git/readGitignore.ts`](packages/git/readGitignore.ts)
- [`packages/shared/hash.ts`](packages/shared/hash.ts)
- [`packages/shared/errors.ts`](packages/shared/errors.ts)
- [`packages/shared/paths.ts`](packages/shared/paths.ts)
- [`packages/shared/constants.ts`](packages/shared/constants.ts)
- [`packages/shared/logger.ts`](packages/shared/logger.ts)
- [`packages/shared/utils.ts`](packages/shared/utils.ts)
- [`packages/shared/types.ts`](packages/shared/types.ts)

**Web application**
- [`apps/web/app/layout.tsx`](apps/web/app/layout.tsx)
- [`apps/web/app/page.tsx`](apps/web/app/page.tsx)
- [`apps/web/app/[org]/[repo]/graph/page.tsx`](apps/web/app/[org]/[repo]/graph/page.tsx)
- [`apps/web/app/api/analyze/route.ts`](apps/web/app/api/analyze/route.ts)
- [`apps/web/lib/utils.ts`](apps/web/lib/utils.ts)
- [`apps/web/next.config.ts`](apps/web/next.config.ts)
- vendor UI components under [`apps/web/vendor-ui/`](apps/web/vendor-ui/) (shadcn, Aceternity, Magic UI primitives adapted for the graph and workspace views)

Everything else in [Repository Layout](#repository-layout) below — including the CLI entry points, the detector suite, the impact package, the search engine, the remaining language parsers, and most of the web app's feature/component layer — is scaffolded with intended file names and signatures, and is being filled in incrementally.

---

## Architecture

```
                 ┌────────────┐       ┌────────────┐
   repository →  │   parser   │  →    │   graph    │  →  dependency / import /
                 └────────────┘       └────────────┘     export / call graph
                        │                    │
                        ▼                    ▼
                 ┌────────────┐       ┌────────────┐
                 │  indexer   │       │ detectors  │  →  issues & convention
                 └────────────┘       └────────────┘     violations
                        │                    │
                        ▼                    ▼
                 ┌────────────────────────────────┐
                 │             engine              │  →  reports, summaries
                 └────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
   ┌─────────────┐             ┌─────────────┐
   │  apps/cli   │             │  apps/web   │
   └─────────────┘             └─────────────┘
```

`engine` is the orchestration layer: it drives `parser` and `git` to build a `repository`, hands that to `graph` and `indexer`, runs `detectors` and `rules` against the result, and produces reports consumed by both `apps/cli` and `apps/web`.

---

## Repository Layout

```
apps/
  cli/          Command-line interface — analyze, graph, impact, doctor, config
  web/          Next.js dashboard — graph explorer, search, impact & issues panels

packages/
  engine/       Pipeline orchestration (repository → graph → report)
  parser/       Language parsers (TS, JS, Python, Go, Rust, Java, C#, C++, PHP, Ruby)
  graph/        Dependency / import / export / call / folder graph construction
  impact/       Blast-radius calculation across files, modules, routes, components
  detectors/    Structural and convention detectors
  rules/        Framework-specific convention rules
  indexer/      Index construction and alias/route/export resolution
  search/       Repository-wide search engine
  watcher/      Filesystem and git watchers for live re-indexing
  git/          Git operations (clone, branch, history, contributors)
  db/           Persistence layer (schema, migrations, stores)
  cache/        Caching layer (file, graph, memory, repository)
  repository/   Core domain model (File, Folder, Module, Node, Edge, Graph)
  ui/           Shared graph styling utilities (color, layout, icons, theme)
  shared/       Config, constants, errors, logging, types, utilities

playground/     Per-language demo repositories used for fixtures and testing
scripts/        Build, benchmark, release, and fixture-generation scripts
tests/          Unit and integration tests
```

See the full generated tree in [`docs/tree.txt`](docs/tree.txt) if present, or run `pnpm aries graph .` to explore the current repository structure interactively.

---

## Getting Started

### Requirements

- Node.js 18 or later
- [pnpm](https://pnpm.io) 8 or later

### Installation

```bash
git clone https://github.com/<org>/aries.git
cd aries
pnpm install
```

### Build

```bash
pnpm build
```

### Run the web dashboard

```bash
cd apps/web
pnpm dev
```

The dashboard will be available at `http://localhost:3000`.

---

## CLI

The CLI lives in [`apps/cli`](apps/cli) and is invoked as `aries`.

| Command | Description | Source |
|---|---|---|
| `aries analyze <path>` | Run a full analysis of a repository | [`analyze.ts`](apps/cli/analyze.ts) |
| `aries graph <path>` | Generate a dependency graph | [`graph.ts`](apps/cli/graph.ts) |
| `aries impact <file>` | Calculate the impact of a change to a file | [`impact.ts`](apps/cli/impact.ts) |
| `aries doctor` | Check repository health and convention compliance | [`doctor.ts`](apps/cli/doctor.ts) |
| `aries config` | Manage Aries configuration | [`config.ts`](apps/cli/config.ts) |

Entry point: [`apps/cli/index.ts`](apps/cli/index.ts)

---

## Web Application

The dashboard in [`apps/web`](apps/web) is built with Next.js App Router.

| Area | Description | Key files |
|---|---|---|
| Graph Explorer | Interactive dependency graph — pan, zoom, minimap, node/edge inspection | [`components/graph/`](apps/web/components/graph) |
| Global Search | Command-palette style search across files, components, routes | [`components/search/GlobalSearch.tsx`](apps/web/components/search/GlobalSearch.tsx) |
| Impact Panel | Change-impact view inside the workspace | [`components/workspace/panels/ImpactPanel.tsx`](apps/web/components/workspace/panels/ImpactPanel.tsx) |
| Issues Panel | Detected violations and convention issues | [`components/workspace/panels/IssuesPanel.tsx`](apps/web/components/workspace/panels/IssuesPanel.tsx) |
| API routes | Analyze, graph, impact, and search endpoints | [`app/api/`](apps/web/app/api) |

Design system notes are documented in [`apps/web/AGENTS.md`](apps/web/AGENTS.md) and [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md).

---

## Language Support

| Language | Parser package |
|---|---|
| TypeScript / JavaScript | [`packages/parser/typescript`](packages/parser/typescript), [`packages/parser/javascript`](packages/parser/javascript) |
| Python | [`packages/parser/python`](packages/parser/python) |
| Go | [`packages/parser/go`](packages/parser/go) |
| Rust | [`packages/parser/rust`](packages/parser/rust) |
| Java | [`packages/parser/java`](packages/parser/java) |
| C# | [`packages/parser/csharp`](packages/parser/csharp) |
| C++ | [`packages/parser/cpp`](packages/parser/cpp) |
| PHP | [`packages/parser/php`](packages/parser/php) |
| Ruby | [`packages/parser/ruby`](packages/parser/ruby) |

Framework-specific convention rules live in [`packages/rules`](packages/rules): Next.js, React, NestJS, Express, Vite, and Electron.

---

## Contributing

Contributions are welcome, particularly toward the modules still marked as scaffolding above.

1. Fork the repository and create a feature branch
2. Run `pnpm test` before opening a pull request
3. Keep changes scoped to a single package where possible — the monorepo boundaries in `packages/` are intentional
4. Open a pull request with a clear description of the change and its motivation

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
