# packages/

The core of ARCLUX lives here — framework-agnostic logic with no UI or
CLI dependencies. Everything in `apps/` is just a thin shell on top of
these packages.

## How it fits together

    clone (git) -> parse (parser) -> index (indexer) -> graph (graph)
                                            |
                        +-------------------+-------------------+
                        |                   |                   |
                  detect issues       trace impact         search/browse
                  (detectors)          (impact)              (search)

Everything is orchestrated by `engine/pipeline.ts`, which is the single
entry point (`analyzeRepository()`) that CLI commands and web API routes
call — nobody should call `buildIndex`, `buildDependencyGraph`, etc.
directly outside of `engine/`.

## Packages

- **`repository`** — the core data model. `File`, `Folder`, `Module`,
  `Node`, `Edge`, `Dependency`, `Graph`. Everything else consumes or
  produces these shapes.
- **`parser`** — turns source files into a shared `ParsedFile` shape
  (imports/exports/warnings). One sub-folder per language
  (`typescript/`, `python/`, `go/`, `java/`, ...), each implementing the
  `LanguageParser` interface so `engine/pipeline.ts` never has to know
  which language it's dealing with. Also contains manifest parsers
  (`go.mod`, `Cargo.toml`, `package.json`, ...) via the separate
  `ManifestParser` interface.
- **`indexer`** — walks a repo, calls the right parser per file, resolves
  raw import strings into actual module ids (handling path aliases,
  same-package implicit dependencies, etc.), and produces a `Repository`.
- **`graph`** — turns an indexed `Repository` into a renderable
  `DependencyGraph` (nodes + edges) that the web UI draws.
- **`detectors`** — 18 independent checks that each take a `Repository`
  and return findings: circular dependencies, dead code, unused exports,
  duplicate modules, orphan files, convention violations, and more.
- **`impact`** — answers "what breaks if I change this file?" by tracing
  consumers/dependents through the graph.
- **`rules`** — framework-specific convention checks (Next.js routes,
  React hooks, NestJS modules, Express routing, Vite config, Electron
  main/preload boundaries).
- **`engine`** — the orchestrator. `analyzeRepository({ repoUrl })` is
  the one function that does clone -> parse -> index -> graph, with
  proper cleanup even on failure.
- **`watcher`** — filesystem/git watching so a running analysis can
  incrementally re-index on file changes instead of doing a full rebuild.
- **`incremental`** — the incremental re-index logic itself, consumed
  by `watcher`.
- **`cache`**, **`db`**, **`search`**, **`ui`** — caching layer,
  persistence, search-over-index, and shared graph-rendering helpers
  (colors, layout, icons) used by `apps/web`.
- **`shared`** — types, `ArcluxError`, and small utilities
  (`hashContent`, `toPosixPath`, `createLogger`, etc.) every other
  package imports from. Read `shared/types.ts` first when exploring this
  codebase — it's the shape of everything.
- **`git`** — clone/cleanup a remote repo into a temp dir, read
  `.gitignore`, inspect branches/history.

## Example: analyzing a repo programmatically

    import { analyzeRepository } from "./packages/engine/pipeline";

    const result = await analyzeRepository({
      repoUrl: "https://github.com/some-org/some-repo.git",
    });

    console.log(result.meta.detectedFrameworks); // e.g. ["nextjs", "react"]
    console.log(result.moduleCount);
    console.log(result.graph.nodes.length, "nodes,", result.graph.edges.length, "edges");

## Example: running a single detector

    import { buildIndex } from "./packages/indexer/buildIndex";
    import { detectCircularDependency } from "./packages/detectors/detectCircularDependency";

    const repository = await buildIndex({ rootPath: "/path/to/repo", meta: { ... } });
    const cycles = detectCircularDependency(repository);

See `scripts/testPlayground.ts` for a fuller working example against the
fixtures in `playground/`.
