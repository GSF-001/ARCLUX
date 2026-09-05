![alt text](https://github.com/GSF-001/ARCLUX/blob/ARCLUX.main/assets/Banner-preview.png) 
## OPEN SOURCE

Dependency graph, impact analysis, and structural convention checking for your codebase. CLI + web dashboard + MCP for AI.

![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-black)
  [](LICENSE)
![Version: 0.3.0](https://img.shields.io/badge/version-0.3.0-3f8fff)
![Status: alpha](https://img.shields.io/badge/status-alpha-black)
[](#status)

[![CI](https://github.com/GSF-001/ARCLUX/actions/workflows/ci.yml/badge.svg)](https://github.com/GSF-001/ARCLUX/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-live-3f8fff)](https://arclux-os.mintlify.site)
[![npm](https://img.shields.io/badge/npm-arclux-cb3837)](https://www.npmjs.com/package/arclux)

<p align="center">
  <img src="assets/demo.gif" alt="ARCLUX CLI in action: arclux analyze . and arclux doctor" />
</p>

![alt text](https://github.com/GSF-001/ARCLUX/blob/ARCLUX.main/assets/Graph-3d-preview.png)
  <br>
  <em>Interactive 3D dependency graph — nodes sized by fan-in, colored by type</em>
</p>

-----

[](https://github.com/GSF-001/ARCLUX/actions/workflows/ci.yml)

## Documentation
> [!NOTE] 
> 
> **[official documentation](https://arclux-os.mintlify.site)**
> content, searchable and organized

> This README is intentionally stable. Live numbers, detailed status, and per-package docs live in the links below and update automatically — you don't need to watch this file for changes.

-----
- [`ABOUT.md`](ABOUT.md) — the ARCLUX map: what it is, the intelligence layer, the platform underneath — **start here if you're new**
- [`QUICKSTART.md`](QUICKSTART.md) — fast-path workflow cheat sheet
- [`QUICKSTART-MMO.md`](QUICKSTART-MMO.md) — MMO game: clone → vessel → self-host region → play (from zero)
- [`TOOLING.md`](TOOLING.md) — all repo config/tooling explained (PROGRES system, git workflow, pre-commit hook, CI, CODEOWNERS, etc.)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — conventions for contributing code
- [`PROGRES.md`](PROGRES.md) (+ [`progres/`](progres/)) — up-to-date project status: what works, what's a stub, decisions, known bugs/gotchas
- [`ARCHITECTURE_MAP.md`](ARCHITECTURE_MAP.md) — boundary map for the codebase, read before adding new capabilities
- [`SKILL.md`](SKILL.md) — auto-discovered by AI coding agents (Claude Code, Cursor, etc); teaches them to use the `arclux` CLI instead of guessing at codebase structure
- [`CONTEXT.md`](CONTEXT.md) — project brief at a glance: stack, architecture, current state.
- [`progres/roadmap.md`](progres/roadmap.md) — long-term direction, phased

## Status

Under active development. This section stays high-level on purpose — for the current, detailed breakdown see [progres/status-core.md](progres/status-core.md), [status-web.md](progres/status-web.md), and the [docs site](https://arclux-os.mintlify.site/status) (updated continuously, this README is not).

Core engine (parse / index / graph / impact / call graph / detectors / framework rules / DSL / search / security) is solid and verified against real repos (vscode, react, vite, laravel, flask). Platform layers (daemon + SSE bridge, persistence via `packages/db`, content-hash caches, watcher) are wired and used in production. Per-file incremental re-index is built but still coarse (full rebuild per change) — see `progres/status-core.md`. MMO product (`apps/game` + `packages/gameserver` + `packages/universe`) is in alpha — see `docs/blueprint/`.

## What it does

- Builds a dependency graph (imports, exports, folders) + call graph (which functions call which, across files) from static analysis
- Traces impact — what is affected if you change file X
- Detects structural issues (circular deps, dead code, orphan files, duplicate modules, layer violations, and more — architecture detectors, auto-discovered — run them all with `arclux doctor`)
- Enforces framework conventions (Next.js, NestJS, Express, Vite, Electron, React, Laravel — `arclux verify` gates on them, auto-discovered)
- Runs scripted analysis — `arclux script file.arclux` executes the ARCLUX DSL (analyze, impact, doctor, security, graph from plain-text scripts)
- Parses many languages: TypeScript/TSX, JavaScript, Python, Go, Java, PHP, Ruby, Rust, C++, C#, Bash, C, Dart, Elixir, Kotlin, Lua, Objective-C, OCaml, Scala, Solidity, Swift, Vue, Zig, Elm, ReScript, plus manifest formats (package.json, go.mod, Cargo.toml, Gemfile, composer.json, csproj, gradle, pom.xml, requirements.txt) — via TypeScript Compiler API + web-tree-sitter. New parsers appear automatically in `arclux config` and `--help`.

> Numbers (detector / rule / language counts) grow automatically as the codebase grows. This README does not chase them — run `arclux --help`, `arclux config`, or see the docs site for live counts.

## Install

```bash
npx arclux analyze .          # or any command — zero setup
npm i -g arclux               # or install once, get the `arclux` binary
```

The package ships every tree-sitter grammar it needs — no native
compilation, no grammar installs. Node 20+.

### From source (development)

    git clone https://github.com/GSF-001/ARCLUX.git
    cd ARCLUX
    pnpm install
    pnpm build:cli             # bundles apps/cli/dist/arclux.mjs + wasms/

Run CLI commands via: `arclux <command>` (installed) or `node apps/cli/dist/arclux.mjs <command>` (bundled).

## Usage

    arclux analyze [path]
    arclux graph [path]
    arclux graph [path] -o out.json
    arclux impact <file> [path]
    arclux doctor [path]
    arclux diff <from> <to> [path]
    arclux diagnose [path]
    arclux verify [path]
    arclux security [path]
    arclux search <query> [path]
    arclux script <file.arclux>
    arclux config [path]
    arclux shell
    arclux mcp

Run `arclux --help` for the full, always-current command list.

Web dashboard:

    cd apps/web
    pnpm run dev

### MCP for AI (self-triggering)

ARCLUX exposes 30+ tools via Model Context Protocol. The server ships workflow instructions so AI agents use the right tool without being asked — `analyze` first, `file_info`/`impact` instead of manual reads, `detect`/`doctor` to verify.

```json
{
  "mcpServers": {
    "arclux": {
      "command": "npx",
      "args": ["arclux", "mcp"]
    }
  }
}
```

See the pinned Discussion “Getting Started — install, CLI usage, MCP client config” and [`SKILL.md`](SKILL.md) for details. New detectors/rules/parsers automatically appear as tools — no manual MCP updates.

## Daemon (always-on background service)

ARCLUX can run as a long-running background process that watches your repo and re-analyzes on every file change:

```bash
arclux daemon --detach
arclux daemon --status
arclux daemon --stop
```

The daemon exposes a local HTTP+SSE bridge (GET /analysis, GET /events) so any editor/terminal can connect — see packages/daemon/.

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
    apps/game       Electron + three.js MMO client (self-host region, vessel = repo)
    packages/       parser, graph, impact, detectors, rules, engine,
                     indexer, search, watcher, incremental, repository,
                     shared, plus runtime/platform layers (kernel, storage,
                     runtime, scheduler, networking, services, ...)
                     plus MMO (gameserver, universe, relay) — see packages/README.md for the full list

## Contributing

We use GitHub Issues to track open work. `main` is protected; all changes go through a pull request.

    git clone https://github.com/GSF-001/ARCLUX.git
    cd ARCLUX && pnpm install

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for conventions, and [`PROGRES.md`](PROGRES.md) (plus [`progres/`](progres/)) for current project status before picking up work.

## License — Dual
- **ARCLUX Platform** (`apps/web`, `apps/cli`, `packages/engine/parser/graph` etc.) — **Apache License 2.0** (see [`LICENSE-ENGINE`](LICENSE-ENGINE)) — graph tetap open, boleh contribute
- **ARCLUX MMO** (`packages/gameserver`, `packages/relay`, `packages/universe`, `apps/game`) — **ARCLUX MMO License v1 (GSF-001)** — **source-available, boleh baca & PR, dilarang deploy/host game komersial clone** tanpa izin tertulis (see [`LICENSE-MMO`](LICENSE-MMO), `SPDX: LicenseRef-ARCLUX-MMO`)
- [`SECURITY.md`](SECURITY.md) 

## Citation

If you use ARCLUX in research or other work, please cite it using the metadata in [`CITATION.cff`](CITATION.cff).

