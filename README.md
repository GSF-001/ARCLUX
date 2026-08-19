# ARCLUX 🦖
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

![alt text](https://github.com/GSF-001/ARCLUX/blob/ARCLUX.main/assets/Graph-3d-preview.png?raw=true)
  <br>
  <em>Interactive 3D dependency graph — nodes sized by fan-in, colored by type</em>
</p>

-----

[](https://github.com/GSF-001/ARCLUX/actions/workflows/ci.yml)

## Documentation
> [!NOTE] 
> 
> **[official documentation](https://arclux-os.mintlify.site)**
content, searchable and organized

-----
- [`ABOUT.md`](ABOUT.md) — what ARCLUX is and what it actually does — **start here if you're new**
- [`QUICKSTART.md`](QUICKSTART.md) — start here, fast-path workflow cheat sheet
- [`TOOLING.md`](TOOLING.md) — all repo config/tooling explained (PROGRES system, git workflow, pre-commit hook, CI, CODEOWNERS, etc.)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — conventions for contributing code
- [`PROGRES.md`](PROGRES.md) (+ [`progres/`](progres/)) — up-to-date project status: what works, what's a stub, decisions, known bugs/gotchas
- [`ARCHITECTURE_MAP.md`](ARCHITECTURE_MAP.md) — boundary map for the codebase, read before adding new capabilities
- [`SKILL.md`](SKILL.md) — auto-discovered by AI coding agents (Claude Code, Cursor, etc); teaches them to use the `arclux` CLI instead of guessing at codebase structure
- [`CONTEXT.md`](CONTEXT.md) — project brief at a glance: stack, architecture, current state.
- [`progres/roadmap.md`](progres/roadmap.md) — long-term direction, phased

## Status: alpha

Under active development. Core pipeline (parse/index/graph/impact), 19 detectors, 14 framework convention rules, CLI + web dashboard + always-on daemon + VS Code extension are solid and verified against real repos (vscode, react, vite, laravel). A few source parsers and the persistence/cache layers are still stubs.

For the current, detailed breakdown -- see [progres/status-core.md](progres/status-core.md), [status-web.md](progres/status-web.md), and the [docs site](https://arclux-os.mintlify.site/status) (updated continuously, this README is not).

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

## Daemon (always-on background service)

ARCLUX can run as a long-running background process that watches your repo and re-analyzes on every file change:

```bash
npx tsx apps/cli/index.ts daemon --detach
npx tsx apps/cli/index.ts daemon --status
npx tsx apps/cli/index.ts daemon --stop
```

The daemon exposes a local HTTP+SSE bridge (GET /analysis, GET /events) so any editor/terminal can connect -- see packages/daemon/.

## VS Code Extension

A minimal VS Code extension (apps/vscode-extension/) connects to a running daemon: Problems panel diagnostics + status bar module count. Build with pnpm install && pnpm build inside apps/vscode-extension/, then load via VS Code's Extension Development Host.

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


