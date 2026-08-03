# ARCLUX

Dependency graph, impact analysis, and structural convention checking for your codebase. CLI + web dashboard.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-black)](LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-black)](#status)

## Status: alpha

This project is under active development with a small team. Expect breaking changes, missing pieces, and stubs that are not wired up yet. See PROGRES.md for a detailed, honest breakdown of what works today vs. what is still a stub.

What is solid right now:
- Core pipeline (clone, parse, index, dependency graph)
- TypeScript/TSX and Python parsing
- All 18 structural detectors (circular deps, dead code, orphan files, duplicate modules, layer violations, entry points, and more)
- Full impact analysis (packages/impact/* - trace consumers/dependents, affected files/modules/components/routes)
- CLI commands: analyze, graph, impact, doctor, config
- Web dashboard: dependency graph viewer, layout/navigation, most UI patterns and primitives

What is not there yet:
- Parsers for Go, Rust, Java, C#, C++, PHP, Ruby (only TS/TSX/Python work today)
- Framework convention rules beyond a starting Next.js rule
- Real search (/api/search is a filename-only stopgap)
- A handful of dashboard panels (workspace, explorer, some overview components)

## What it does

- Builds a dependency graph (imports, exports, folders) from static analysis
- Traces impact - what is affected if you change file X
- Detects circular deps, dead code, orphan files, duplicate modules, layer violations, and more (18 detectors)
- Enforces framework conventions (Next.js today, more frameworks planned)
- Parses TypeScript, JavaScript, and Python today; more languages planned

## Install (from source)

Not yet published to npm. Clone and build locally:

    git clone https://github.com/<org>/arclux.git
    cd arclux
    npm install

Run CLI commands via: npx tsx apps/cli/index.ts <command>

## Usage

    npx tsx apps/cli/index.ts analyze [path]
    npx tsx apps/cli/index.ts graph [path]
    npx tsx apps/cli/index.ts graph [path] -o out.json
    npx tsx apps/cli/index.ts impact <file> [path]
    npx tsx apps/cli/index.ts doctor [path]
    npx tsx apps/cli/index.ts config [path]

Web dashboard:

    cd apps/web
    npm run dev

## How it works

    repository -> parser -> graph -> detectors -> engine -> report
                              -> rules (framework conventions)
                              -> impact (consumer/dependent tracing)

Each stage is an independent package: parser, graph, impact, detectors, rules, engine.

## Structure

    apps/cli        command-line interface
    apps/web        Next.js dashboard
    packages/       parser, graph, impact, detectors, rules, engine,
                     indexer, search, watcher, git, db, cache,
                     repository, incremental

## Contributing

We use GitHub Issues to track open work. main is protected; all changes go through a pull request.

    git clone https://github.com/<org>/arclux.git
    cd arclux && npm install

See CONTRIBUTING.md for conventions, and PROGRES.md for current project status before picking up work.

## License

Apache License 2.0 (c) ARCLUX Contributors
