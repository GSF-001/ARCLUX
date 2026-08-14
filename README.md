# ARCLUX 🐳
- OPEN SOURCE

Dependency graph, impact analysis, and structural convention checking for your codebase. CLI + web dashboard.

![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-black)
 [](LICENSE)
![Status: alpha](https://img.shields.io/badge/status-alpha-black)
[](#status)

[![CI](https://github.com/GSF-001/ARCLUX/actions/workflows/ci.yml/badge.svg)](https://github.com/GSF-001/ARCLUX/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-live-3f8fff)](https://arclux-os.mintlify.site)

<p align="center">
  <img src="assets/demo.gif" alt="ARCLUX CLI in action: arclux analyze . and arclux doctor" />
</p>

-----

[](https://github.com/GSF-001/ARCLUX/actions/workflows/ci.yml)

## Documentation
> [!NOTE]
>  **[Browse the full docs site](https://arclux-os.mintlify.site)** — same content, searchable and organized
-----
- [`QUICKSTART.md`](QUICKSTART.md) — start here, fast-path workflow cheat sheet
- [`TOOLING.md`](TOOLING.md) — all repo config/tooling explained (PROGRES system, git workflow, pre-commit hook, CI, CODEOWNERS, etc.)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — conventions for contributing code
- [`PROGRES.md`](PROGRES.md) (+ [`progres/`](progres/)) — up-to-date project status: what works, what's a stub, decisions, known bugs/gotchas
- [`ARCHITECTURE_MAP.md`](ARCHITECTURE_MAP.md) — boundary map for the codebase, read before adding new capabilities
- [`CONTEXT.md`](CONTEXT.md) — project brief at a glance: stack, architecture, current state.
- [`progres/roadmap.md`](progres/roadmap.md) — long-term direction, phased

## Status: alpha

This project is under active development with a small team. Expect breaking changes, missing pieces, and stubs that are not wired up yet. See [`PROGRES.md`](PROGRES.md) (and the linked files in [`progres/`](progres/)) for a detailed, honest breakdown of what works today vs. what is still a stub — that's the up-to-date source of truth, this README is a summary.

What is solid right now:
- Core pipeline (clone, parse, index, dependency graph + call graph)
- Parsing: TypeScript/TSX, JavaScript (ESM/JSX/CommonJS), Python, Go, Java + 10 manifest parsers
- 19 structural detectors (circular deps, dead code, orphan files, duplicate modules, layer violations, entry points, component/route/story/test conventions, and more) — `arclux doctor` runs all of them; `arclux verify` gates on the core 10 for its PASS/FAIL verdict. Entry points (Next.js App Router files, CLI entry) are filtered out of unused-export/orphan false positives.
- Full impact analysis (packages/impact/* - trace consumers/dependents, affected files/modules/components/routes)
- Real search engine (packages/search/* — fuzzy path + export-name matching, used by `/api/search`)
- Framework convention rules (14 rules: Next.js, NestJS, Express, Vite, Electron, React, Laravel — `arclux verify` gates on them)
- CLI commands: analyze, graph, impact, doctor, config, diff, diagnose, verify
- Web dashboard: dependency graph viewer, layout/navigation, most UI patterns and primitives
- Verified against large real-world repositories (microsoft/vscode, facebook/react, vitejs/vite, laravel/laravel) in addition to internal fixtures

What is not there yet:
- General-purpose source parsers for Rust, C#, C++, PHP, Ruby (dependency-manifest parsing exists for all of these; PHP has route-file parsing — `packages/parser/php/parsePhpRoutes.ts` — but the general `.php` source parser is deliberately deferred, see `progres/decisions.md`)
- True per-file incremental re-analysis (`packages/incremental` + `packages/watcher` are built and verified standalone; `watchRepository` wraps the pipeline in a coarse change-level cache, but `buildIndex` still does a full rebuild — see `progres/decisions.md`)
- A handful of dashboard panels (workspace, explorer, some overview components) are not mounted on any page yet

## What it does

- Builds a dependency graph (imports, exports, folders) + call graph (which functions call which, across files) from static analysis
- Traces impact - what is affected if you change file X
- Detects circular deps, dead code, orphan files, duplicate modules, layer violations, and more (19 detectors — run them all with `arclux doctor`)
- Enforces framework conventions (14 rules: Next.js, NestJS, Express, Vite, Electron, React, Laravel — `arclux verify` gates on them)
- Parses TypeScript, JavaScript, Python, Go, and Java today; more languages planned

## Install (from source)

> [!NOTE]
> Installation via npm is deprecated. Use one of the recommended methods below.

Not yet published to npm. Clone and build locally:

    git clone https://github.com/GSF-001/ARCLUX.git
    cd ARCLUX
    pnpm install

Run CLI commands via: `npx tsx apps/cli/index.ts <command>`

## Usage

    npx tsx apps/cli/index.ts analyze [path]
    npx tsx apps/cli/index.ts graph [path]
    npx tsx apps/cli/index.ts graph [path] -o out.json
    npx tsx apps/cli/index.ts impact <file> [path]
    npx tsx apps/cli/index.ts doctor [path]
    npx tsx apps/cli/index.ts diff <from> <to> [path]
    npx tsx apps/cli/index.ts diagnose [path]
    npx tsx apps/cli/index.ts verify [path]
    npx tsx apps/cli/index.ts config [path]

Web dashboard:

    cd apps/web
    pnpm run dev

## How it works

    repository -> parser -> graph -> detectors -> engine -> report
                              -> rules (framework conventions)
                              -> impact (consumer/dependent tracing)

Each stage is an independent package: parser, graph, impact, detectors, rules, engine.

## Structure

    apps/cli        command-line interface (analyze, graph, impact, doctor, config, diff, diagnose, verify)
    apps/web        Next.js dashboard
    packages/       parser, graph, impact, detectors, rules, engine,
                     indexer, search, watcher, incremental, repository,
                     shared, plus runtime/platform layers (kernel, storage,
                     runtime, scheduler, networking, services, ...)
                     see packages/README.md for the full list

## Contributing

We use GitHub Issues to track open work. `main` is protected; all changes go through a pull request.

    git clone https://github.com/GSF-001/ARCLUX.git
    cd ARCLUX && pnpm install

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for conventions, and [`PROGRES.md`](PROGRES.md) (plus [`progres/`](progres/)) for current project status before picking up work.

## License
Apache License 2.0 (c) ARCLUX Contributors
- [`SECURITY.md`](SECURITY.md) 

## Citation

If you use ARCLUX in research or other work, please cite it using the metadata in [`CITATION.cff`](CITATION.cff).


