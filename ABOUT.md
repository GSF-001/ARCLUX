# ABOUT ARCLUX

**ARCLUX is an open-source platform that reads code the way an operating system reads hardware — and turns it into a living map of the repository.** Point it at any codebase and it parses the source, computes how everything connects, and answers questions like *"what breaks if I change this file?"* or *"this file is never imported — where was it supposed to be wired?"* — in seconds, without you reading 800 files first.

ARCLUX is built in two layers:

- **The intelligence layer** — the flagship capability: static analysis, dependency/call graphs, impact tracing, 20 automated code-health detectors, 14 framework convention rules, and a security pipeline. This is what works end-to-end today and is verified against real repos (vscode, react, vite, laravel, django, flask).
- **The platform layer** — the runtime underneath: a kernel with a signal bus, process manager, job scheduler, service manager, storage, networking, notifications, and orchestration. This is the foundation ARCLUX grows on — codebase intelligence is the first application of the platform, not the last.

Everything in this file is real and working. No marketing promises — every claim is backed by code and verified runs.

---

## The map

```
                      ┌─────────────────────────────────────────────┐
                      │            ARCLUX PLATFORM                 │
                      │                                             │
   INTELLIGENCE       │  kernel ── signal bus (every subsystem      │
   LAYER              │  talks through this)                        │
   ───────────        │  runtime ── process manager                 │
   parser (27 langs)  │  scheduler ── job queue                     │
   graph / call graph │  services ── service lifecycle              │
   impact analysis    │  storage ── artifacts, cache, recovery      │
   20 detectors       │  networking ── connections, ports, endpoints│
   14 convention rules│  notifications ── event fan-out to channels │
   security pipeline  │  orchestration ── PlatformOrchestrator      │
   scripting DSL      │                                             │
   provenance         │                                             │
                      └─────────────────────────────────────────────┘
        │                         │
        │  consumed through       │  consumed through
        ▼                         ▼
   ┌──────────────┐        ┌──────────────────────────────────┐
   │  CLI + shell │        │  daemon (HTTP+SSE bridge)         │
   │  web app     │        │  VS Code extension                │
   │  security CLI│        │  any tool that can read HTTP/SSE  │
   └──────────────┘        └──────────────────────────────────┘
```

## The intelligence layer — what you can do with it

| Command | What it gives you |
|---|---|
| `arclux analyze <repo>` | Full index: modules, imports, exports, dependency graph, call graph |
| `arclux graph <repo>` | Interactive dependency graph (SVG + d3-force, 3D view in web) |
| `arclux impact <file>` | "If I change this file, 1,319 files are affected" — real result from analyzing django |
| `arclux doctor <repo>` | 20 automated checks: circular deps, dead code, orphan files (with where-to-integrate suggestions), duplicate modules, layer violations, and more |
| `arclux verify <repo>` | 14 framework convention rules (Next.js, NestJS, Express, Vite, Electron, React, Laravel) |
| `arclux security <repo>` | Secrets, unsafe patterns, sensitive data flow, trust boundaries, attack surface, dependency risk |
| `arclux search <query>` | Full-text + symbol search across the codebase |
| `arclux script <file.arclux>` | Run the ARCLUX scripting DSL — chain analyze → doctor → impact → security in one readable script |
| Web audit | `/{org}/{repo}/audit` — findings theater (STREAM × FOCUS × GRAPH), plus **live severity halos on the 3D graph** while the audit replays |
| `arclux diff <a> <b>` | What changed between two states, structurally |
| `arclux diagnose <repo>` | Deep-dive diagnostics for problem hunting |
| `arclux shell` | Interactive REPL — analyze once, then ask impact/deps/doctor/graph/search instantly, with `watch on` for live re-analysis |
| `arclux daemon` | Always-on background watcher with a local HTTP+SSE bridge (`/analysis`, `/impact`, `/events`) |
| VS Code extension | Live status bar, Problems-panel diagnostics, and `ARCLUX: Trace Impact` right from the editor |
| Web dashboard | Next.js UI: workspace (Impact/Issues/Security/Verify/Health/Calls), explorer, audit theater, opencode-style script playground, Ctrl+K command palette — `apps/web`, `pnpm run dev` |

### The 20 detectors

Automated code-health checks, each an independent small file that is trivial to extend:

- `circularDependency` — import cycles, with the full cycle path
- `unusedExports` / `unusedFiles` — code that nothing consumes
- `orphanFiles` — files nothing imports, **classified**: *dead* (leftover, delete it) vs *unwired* (should be connected) vs *ambiguous*
- `orphanIntegration` — for unwired files, **where** they should be imported: the folder's barrel index, or the shared importer of same-kind siblings (confidence + score + evidence, derived from real patterns — never guessed)
- `largeModules` / `duplicateModules` / `sharedModules` / `indexFiles` — structural smell detection
- `layerViolation` — imports that cross architecture layers
- `deadCode` / `ambiguousSymbolResolution` / `missingExports`
- `componentConvention` / `featureStructure` / `repositoryPattern` / `routeConvention` / `storyConvention` / `testConvention` / `entryPoints`

### Remote sources & security boundaries

`arclux analyze https://github.com/org/repo` clones, analyzes, and cleans up. Source adapters route any input — GitHub, GitLab (https/ssh/SCP-style), archive files, local paths (`~` expanded) — through the right boundary check:

- **SSRF guard** — remote URLs are refused before anything else if they point at private networks, loopback, link-local, or cloud metadata endpoints (169.254.169.254). Public hosts — GitHub, GitLab, Bitbucket, any web server — are always allowed.
- **Source boundary** — local paths are checked against allowed/denied roots with symlink containment.
- **Evidence boundary** — doctor/security output is redacted (tokens, keys, passwords, AWS credentials, private keys, connection strings) and per-check capped.
- **Analysis boundary** — hard caps on files/bytes/modules so no single run can exhaust the host.

## What ARCLUX understands

- **Languages parsed today:** TypeScript/TSX, JavaScript, Python, Go, Java, PHP, Ruby, Rust, C++, C#, Bash, C, Dart, Elixir, Kotlin, Lua, Objective-C, OCaml, Scala, Solidity, Swift, Vue, Zig, Elm, ReScript — via TypeScript Compiler API + web-tree-sitter (25 grammar-backed, 2 compiler-API-backed, plus manifest parsers for package.json, go.mod, Cargo.toml, Gemfile, composer.json, csproj, gradle, pom.xml, requirements.txt)
- **Frameworks with convention rules:** Next.js, NestJS, Express, Vite, Electron, React, Laravel
- **Graphs:** dependency (imports/exports/folders) and call graph (which function calls which, across files) + folder graph

## The ARCLUX DSL — scripting the analysis

`arclux script <file.arclux>` runs a tiny scripting language purpose-built for
codebase intelligence. Scripts read like instructions, not API calls:

```arclux
# analyze the repo, then answer questions about it
repo = analyze("~/flask")

# what's affected if I change app.py?
impact(repo, "app.py")

# which files does nothing import, and where should they go?
check(repo, "orphanFiles")
```

Every capability the engine exposes is bound into the DSL — analyze, doctor,
check, graph, callgraph, impact, search, security, diff, archdiff, plus helpers
(len, sum, filter, sort, exists, keys, values, env, cwd, extensions, checkids).
The language grows automatically: registering a new parser or detector expands
`extensions()` / `checkids()` with zero DSL changes (verified live — the 5 new
parsers from PR #528 grew the binding surface from 9 to 19 extensions on their
own). The browser playground at `/script` runs the same DSL server-side —
including an **audit mode** that streams doctor + security + attack-surface
findings as a terminal theater and replays them as breathing halos on the
3D dependency graph.

## How it works (the 10-second version)

```
repository → parser → graph → detectors → engine → report
                       → rules (framework conventions)
                       → impact (consumer/dependent tracing)
                       → security pipeline
```

Each stage is an independent package (`parser`, `graph`, `impact`, `detectors`, `rules`, `engine`, `security`). Add a new parser, detector, or rule without touching the rest. The single entry point is `analyzeRepository` in the engine pipeline — nothing calls individual steps from outside.

## The platform layer

Beneath the intelligence layer sits a real runtime, not scaffolding:

- **kernel** — a signal bus every subsystem emits and subscribes through (`Kernel`)
- **runtime** — `ProcessManager` spawns and supervises child processes (`RuntimeManager`)
- **scheduler** — `JobScheduler` + `JobQueue` for async work
- **services** — `ServiceManager` manages service lifecycle and dependencies
- **storage** — `ArtifactStore`, `CacheManager`, `RecoveryManager` (crash-safe writes), `SnapshotManager`
- **networking** — `ConnectionManager`, `PortManager`, `ServiceEndpoint` discovery files
- **notifications** — `NotificationManager` fans events out to channels
- **orchestration** — `PlatformOrchestrator` assembles it all

The daemon, watcher, incremental indexer, shell session, and workspace layers sit on top of these. Packages like `observation`, `web-intake`, and `package-manager` mark the direction the platform is heading — not yet wired, but the seams are already there.

## What ARCLUX does NOT do yet (honest)

- Analysis history is persisted per-run (JSON-record store wired into the daemon), but there's no query layer over it yet — `packages/db` has schema + stores, higher-level queries aren't built
- Per-file incremental re-indexing: the incremental engine is built, but `buildIndex` still does a full rebuild per change — per-file wiring is deferred
- The platform's runtime layers (scheduler/services/storage/observation/web-intake) are built but not all wired to consumers
- Some exotic tree-sitter grammars shipped in `tree-sitter-wasms` are stale (elm was ABI 12 — vendored fix; ReScript's wasm predates its modern `import` syntax) — see `packages/parser/wasms/`
- Installation is from source only — not yet published to npm

## Where to go next

- [`QUICKSTART.md`](QUICKSTART.md) — fast-path workflow cheat sheet
- [`CONTEXT.md`](CONTEXT.md) — stack, architecture, current state at a glance
- [docs site](https://arclux-os.mintlify.site) — full, searchable documentation
- [`PROGRES.md`](PROGRES.md) (+ [`progres/`](progres/)) — live status: what works, what's a stub, known bugs