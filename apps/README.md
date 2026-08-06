# apps/

The two user-facing surfaces of ARCLUX. Both are thin — all the real
logic lives in `packages/`.

## apps/cli

A command-line tool for analyzing a repo without the web UI.

    cd apps/cli
    npx tsx index.ts analyze https://github.com/org/repo.git
    npx tsx index.ts graph https://github.com/org/repo.git
    npx tsx index.ts impact https://github.com/org/repo.git --file src/index.ts
    npx tsx index.ts doctor

| Command | What it does |
|---|---|
| analyze | Clones + indexes a repo, prints a summary (modules, detected frameworks, issues found) |
| analyzeLocal | Same as analyze but against a local path instead of cloning |
| graph | Builds and prints/exports the dependency graph |
| impact | Given a file, shows what depends on it (direct + transitive consumers) |
| doctor | Environment/setup diagnostics — checks Node version, missing deps, etc. |
| config | Read/write ARCLUX CLI configuration |

## apps/web

A Next.js app for browsing an analyzed repo visually — dependency graph,
file explorer, impact viewer, search.

    cd apps/web
    pnpm install
    pnpm dev

Then open http://localhost:3000, paste a repo URL, and browse.

### Structure

- **`app/`** — Next.js App Router pages and API routes
  (`/api/analyze`, `/api/graph`, `/api/impact`, `/api/search`)
- **`components/graph/`** — the interactive graph canvas (SVG +
  d3-force physics layout), including node/edge rendering, focus view,
  context menus, and search-within-graph
- **`components/workspace/`** — the main browsing layout (file panel,
  impact panel, issues panel)
- **`components/explorer/`** — file detail + impact summary views
- **`components/ui/`** — thin re-exports of shadcn/ui primitives from
  `vendor-ui/`, so the rest of the app imports from one consistent path
- **`vendor-ui/`** — vendored shadcn/Aceternity/Magic UI components
- **`features/`** — Zustand-style stores + hooks per domain (graph,
  impact, issues, repository, search) that connect UI components to
  `packages/` via the API routes
- **`theme/`** — design tokens (colors, spacing, typography, motion),
  including a dedicated graph color palette

### Why Webpack, not Turbopack

Turbopack isn't supported on Termux/arm64 in this Next.js version, so
next.config.ts is pinned to Webpack. See root PROGRES.md gotchas for
the full story if you're wondering why the build config looks unusual.
