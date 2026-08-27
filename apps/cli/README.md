# ARCLUX CLI + Library

ARCLUX is a codebase intelligence platform: 27-language parser, dependency &
call graphs, 20 architecture detectors, impact tracing, security pipeline, and
the ARCLUX scripting DSL.

## Install

```bash
npm install -g arclux      # CLI
# or run without installing:
npx arclux <command>
```

## CLI

```bash
arclux analyze [path]      # parse, index, build dependency graph
arclux graph [path]        # visualize the dependency graph (SVG)
arclux impact <file>       # trace what a change affects
arclux verify [path]       # run framework rules
arclux doctor              # self-check the pipeline
arclux mcp                 # start the Model Context Protocol server
```

Run `arclux --help` for the full command list.

## Library (embed in your own tool)

The `arclux` package exposes the full analysis engine as a programmatic API —
no CLI, no UI dependencies. Build static-analysis, code-review, or refactor
tooling on top of it.

```ts
import { analyzeRepository, type AnalyzeRepositoryResult } from "arclux";

const result = await analyzeRepository({ localPath: "./my-repo" });
console.log(result.meta.name);
console.log(`${result.moduleCount} modules, ${result.graph.nodes.length} nodes`);
```

Also exported:

- **Engine** — `analyzeRepository`, `ensureParsersRegistered`, `parseOrgAndName`
- **Graphs** — `buildDependencyGraph`, `buildCallGraph`, `buildImportGraph`,
  `buildExportGraph`, `buildFolderGraph`
- **Impact** — `traceConsumers`, `traceDependencies`, `calculateAffectedFiles`,
  `calculateAffectedModules`, `calculateAffectedRoutes`,
  `calculateAffectedComponents`, `buildImpactTree`
- **Search** — `buildSearchIndex`, `search`
- **Security** — `analyzeRepositorySecurity`, `mapAttackSurface`
- **Rules** — `runRules`
- **Diagnostics** — `runDiagnostics`, `getFixSuggestions`

> Note: `Repository` stores modules in a private `Map`. Never
> `JSON.stringify()` it directly or spread it into an API response — it
> serializes to an empty `{}`. Derive a plain object first.

## Development

```bash
node scripts/build-cli.mjs   # bundles dist/arclux.mjs + dist/arclux-lib.mjs + types
```
