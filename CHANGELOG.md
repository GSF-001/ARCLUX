# Changelog

All notable changes to ARCLUX are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); versioning follows
[SemVer](https://semver.org/) (pre-1.0: minor bump = significant features).

## [0.2.1] — 2026-08-26

### Added
- **MCP server (32 tools)** — `arclux mcp` starts the Model Context
  Protocol server; registry-driven auto-evolution (new detectors/rules
  appear automatically in tool descriptions).
- **Library / SDK exports** — `import { analyzeRepository } from "arclux"`
  exposes the full analysis engine programmatically (graphs, impact,
  search, security, rules, diagnostics) with typed `.d.ts` declarations,
  separate from the CLI bundle.

## [0.2.1] — 2026-08-23

### Added
- **Published to npm as `arclux`** — `npx arclux analyze .` from anywhere.
  One-file esbuild bundle (self-contained, wasms shipped alongside) +
  treeSitterLoader resolves grammars from the package location when not
  in a dev checkout.

Web experience wave — the engine is unchanged, the surface caught up.

### Added

**Audit — the flagship feature**
- `POST /api/audit`: composition of runDoctor + securityAnalysis +
  attack surface, grouped into narrative chapters (severity-first)
- `/[org]/[repo]/audit` standalone page + audit mode inside the script
  playground: STREAM (systemd-style boot, 55ms scan reveal built from
  real findings) × FOCUS (one finding at a time, file preview overlay)
  × GRAPH (camera flies per finding, cycle-path HUD)
- **Live audit on the 3D graph**: severity halos breathe on flagged
  nodes as findings replay — driven from outside the renderer (zero
  core changes); auto-switches 2D→3D on launch

**Web/CLI parity routes**: `/api/security`, `/api/verify`, `/api/script`
- Workspace tabs: Security · Verify · Health (Phase 2 scoring) · Calls

**Script playground v2 — opencode-style terminal**
- Slash-command palette (11 commands), syntax-highlighted editor,
  JSON-tree output, transcript with per-run echo + ms, Ctrl+Enter

**Navigation system**
- `lib/navigation.ts` registry — sidebar, mobile bottom bar + More
  sheet, and the Ctrl+K command palette all render from one source
- Pending spinners on every nav surface (useLinkStatus) — slow
  navigations never read as dead clicks
- View-mode toggle (auto/desktop/mobile) persisted per user

**Terminal craft**: JetBrains Mono, `$` prompt prefixes, systemd
`[ OK ]` status tokens, steps(1) cursor blink, CRT scanlines

### Fixed
- Audit halos never appeared (filePath missing from scene node
  objects — map now built from provider graph) 
- `packages/dsl` first real typecheck surfaced 13 latent errors; 3
  bindings were silently broken (search/diff/archdiff read fields
  that don't exist)
- Landing page claimed "2 languages" (actual: 27)

## [0.2.0] — 2026-08-21

~1,020 commits since `v0.1.0-alpha`. Still alpha — expect breaking changes.

### Added

**ARCLUX DSL — scripting language**
- `arclux script <file.arclux>`: lexer/parser/runtime/bindings for a
  purpose-built scripting language over the engine (`packages/dsl`)
- Built-ins: analyze, doctor, check, graph, callgraph, impact, search,
  security, diff, archdiff + helpers (len, sum, filter, sort, exists,
  keys, values, env, cwd, extensions, checkids)
- Registry-driven: `extensions()` / `checkids()` grow automatically when
  new parsers/detectors register — no DSL code changes needed

**Language support: 5 → 27 languages**
- New via shared tree-sitter loader + config-driven factory
  (`makeTreeSitterParser`): PHP, Ruby, Rust, C++, C#, Bash, C, Dart,
  Elixir, Kotlin, Lua, Objective-C, OCaml, Scala, Solidity, Swift, Vue,
  Zig, Elm, ReScript
- Manifest parsers: package.json, go.mod, Cargo.toml, Gemfile,
  composer.json, csproj, gradle, pom.xml, requirements.txt
- Vendored elm wasm (`packages/parser/wasms/`) — npm build is ABI-stale;
  loader checks vendored dir first
- Fixed web-tree-sitter race: concurrent `Language.load()` calls now
  serialized in the shared loader

**Analysis & intelligence**
- 20 architecture detectors (up from 18), including orphan-file
  classification (dead/unwired/ambiguous) and orphan-integration
  suggestions with confidence + evidence
- Security pipeline: secrets, unsafe patterns, sensitive-data flow,
  trust boundaries, attack surface, dependency risk
- Full-text + symbol search engine (`packages/search`, `/api/search`)
- Call graph across files; folder graph; export/import graphs
- Impact analysis: direct consumers + affected-files tree

**Platform & delivery**
- Always-on daemon with HTTP+SSE bridge (`/analysis`, `/impact`,
  `/events`), persisted re-analysis history via `packages/db`
  (RepoStore/AnalysisStore/IssueStore)
- VS Code extension: status bar, Problems-panel diagnostics, trace impact
- Interactive shell REPL (`arclux shell`) with watch mode
- Source adapters: GitHub/GitLab URLs, archives, local paths — with SSRF
  guards (private-network/metadata endpoints refused) and source/evidence/
  analysis boundaries
- Persistence layer wired: schema v1 + three stores used by the daemon
- Caching layer: file/repository/graph content-hash caches +
  CacheProvider stats/clear + MemoryCache

**Web dashboard**
- Workspace, explorer, overview pages; graph focus view with history nav
  and expand-on-demand; activity page (commit history/contributors)

### Changed
- Documentation fully synced to current reality (README, ABOUT, CONTEXT,
  docs-site Docusaurus + Mintlify, CITATION.cff)
- Repo description/topics updated on GitHub

### Fixed
- `scripts/` accidentally deleted from main (PR #528 stash-pop side
  effect) — restored, including both docs generators and log-progress.sh
- web-tree-sitter concurrent grammar-load race ("Incompatible language
  version 0")

### Known limitations (honest)
- Per-file incremental re-index built but not wired into `buildIndex`
  (daemon uses coarse full rebuilds)
- 5 platform packages remain header-only stubs: observation, services,
  package-manager, ui, web-intake

## [0.1.0-alpha] — 2026-08-07

Initial public baseline: TypeScript/JavaScript/Python/Go/Java parsing,
dependency graph, impact analysis, 18 detectors, CLI + early web UI.
