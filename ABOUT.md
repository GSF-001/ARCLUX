# ABOUT ARCLUX

**ARCLUX is an open-source codebase analysis tool.** Point it at any repository and it reads the code, builds a map of how everything connects, and answers questions like *"what breaks if I change this file?"* — in seconds, without you reading 800 files first.

This file explains what ARCLUX is **for**, and what it concretely **does**. Everything here is real and working — verified against repos like vscode, react, vite, laravel, and django.

---

## What problem does it solve?

When you join a codebase (or revisit your own after a week), the hardest questions are structural:

- "Which files import this file? Who else would break?"
- "Where is this function called from?"
- "Is this code still used, or is it dead?"
- "Is this repo following its own framework conventions?"

ARCLUX answers these from static analysis. No build step, no running the app, no "trust me, it works" — it parses the source and computes the answers.

## What you can do with it (concrete)

| Command | What it gives you |
|---|---|
| `arclux analyze <repo>` | Full index: modules, imports, exports, dependency graph |
| `arclux graph <repo>` | Interactive dependency graph (SVG + d3-force, 3D view in web) |
| `arclux impact <file>` | "If I change this file, 1,319 files are affected" — real result from analyzing django |
| `arclux doctor <repo>` | 19 automated checks: circular deps, dead code, orphan files, duplicate modules, layer violations, and more |
| `arclux verify <repo>` | 14 framework convention rules (Next.js, NestJS, Express, Vite, Electron, React, Laravel) |
| `arclux search <query>` | Full-text + symbol search across the codebase |
| `arclux diff <a> <b>` | What changed between two states, structurally |
| `arclux diagnose <repo>` | Deep-dive diagnostics for problem hunting |
| `arclux shell` | Interactive REPL — analyze once, then ask impact/deps/doctor/graph/search instantly, with `watch on` for live re-analysis |
| `arclux daemon` | Always-on background watcher with a local HTTP+SSE bridge (`/analysis`, `/events`) |
| Web dashboard | Next.js UI: workspace, explorer, overview, graph focus view — open `apps/web`, run `pnpm run dev` |

Remote sources work too: `arclux analyze https://github.com/org/repo` clones, analyzes, and cleans up. The SSRF guard makes sure the server only ever reaches public hosts — private networks and cloud metadata endpoints are refused.

## What ARCLUX understands

- **Languages parsed today:** TypeScript/TSX, JavaScript, Python, Go, Java (TypeScript Compiler API + web-tree-sitter)
- **Frameworks with convention rules:** Next.js, NestJS, Express, Vite, Electron, React, Laravel
- **Detectors:** 19 built-in (circular dependency, dead code, orphan files, unused exports, large modules, shared modules, ambiguous symbol resolution, secrets/unsafe patterns, and more)
- **Graphs:** dependency (imports/exports/folders) and call graph (which function calls which, across files)

## How it works (the 10-second version)

```
repository → parser → graph → detectors → engine → report
                       → rules (framework conventions)
                       → impact (consumer/dependent tracing)
```

Each stage is an independent package (`parser`, `graph`, `impact`, `detectors`, `rules`, `engine`). Add a new parser, detector, or rule without touching the rest.

## What ARCLUX does NOT do yet (honest)

- Persistence/cache layer (`packages/db`) is still a stub — no saved analysis history across runs yet
- True per-file incremental re-indexing is still coarse (a change re-analyzes, but not file-by-file)
- Only 5 languages parsed so far; Ruby/PHP/Rust/C# parsers don't exist yet (PHP route detection is file-pattern based)
- Installation is from source only — not yet published to npm

## Where to go next

- [`QUICKSTART.md`](QUICKSTART.md) — fast-path workflow cheat sheet
- [`CONTEXT.md`](CONTEXT.md) — stack, architecture, current state at a glance
- [docs site](https://arclux-os.mintlify.site) — full, searchable documentation
- [`PROGRES.md`](PROGRES.md) (+ [`progres/`](progres/)) — live status: what works, what's a stub, known bugs