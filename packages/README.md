# packages/

Status of every package in this workspace, generated from an actual file
scan (line count per .ts file, <=9 lines = license header only = stub),
not from memory. Re-run this to refresh:

    for dir in packages/*/; do
      name=$(basename "$dir")
      total=$(find "$dir" -name "*.ts" -not -path "*/node_modules/*" | wc -l)
      stubs=$(find "$dir" -name "*.ts" -not -path "*/node_modules/*" -exec sh -c 'test $(wc -l < "$1") -le 9' _ {} \; -print | wc -l)
      echo "$name: $total files total, $stubs still stub/empty"
    done

Legend: working (>=80% implemented) / partial (20-79%) / stub (<20%)

| Folder | Purpose | Files | Stub | Status |
|---|---|---|---|---|
| repository | Core data model - File, Folder, Module, Node, Edge, Dependency, Graph | 8 | 0 | working |
| detectors | 18 architecture/convention detectors (circular dep, dead code, unused exports, etc.) | 18 | 0 | working |
| impact | Impact analysis - trace imports/exports/consumers, calculate affected files/modules/routes | 9 | 0 | working |
| incremental | Incremental re-indexing support | 6 | 0 | working |
| shared | Types, errors, constants, hash, logger, paths, utils - used by every other package | 8 | 1 | working |
| parser | Per-language source + manifest parsers (TS/JS/Python/Go/Java + go.mod/Cargo.toml/package.json/composer.json/Gemfile/pom.xml) | 35 | 6 | working |
| graph | Builds dependency/folder graphs from an indexed Repository | 7 | 1 | working |
| watcher | Filesystem/git watching for incremental re-indexing | 4 | 1 | partial |
| indexer | Turns parsed files into a resolved module index; alias resolution done, route/component/hook resolution still stub | 11 | 8 | partial |
| git | Clone/cleanup/gitignore done; branch history, contributors, default-branch detection still stub | 8 | 5 | partial |
| engine | Pipeline orchestration (analyzeRepository, framework/pkg-manager detection) done; individual analyze*/generate* passes still stub | 11 | 9 | partial |
| search | Search over an indexed repository | 7 | 6 | stub |
| rules | Framework-specific convention rules (Next.js, React, NestJS, Express, Vite, Electron) | 15 | 13 | stub |
| cache | Caching layer (file/graph/memory/repository cache) | 5 | 5 | stub |
| db | Persistence layer (client, schema, repositories) | 5 | 5 | stub |
| ui | Graph visualization helpers (color, layout, theme, icons, animation) for apps/web | 5 | 5 | stub |

## Notes

- No packages are currently claimed by a specific collaborator as of this
  writing - partial/stub folders above are open to pick up, not blocked
  on anyone. If you start one, note it here so others don't duplicate work.
- indexer's stub files (resolveRoutes, resolveComponents, resolveHooks,
  etc.) are a known source of false positives in detectors - e.g. Next.js
  page files and Python/Go/Java entry points without explicit imports show
  up as "orphan"/"unused" until these are filled in. See root PROGRES.md
  for specifics already run into.
- parser's 6 remaining stubs are source-code parsers for languages ARCLUX
  claims to support but hasn't implemented yet (check packages/parser/*/
  for which - csharp/cpp/php/ruby/rust source parsers, as distinct from
  the manifest parsers in the same folders, which ARE done).
- Percentages are file-count based, not effort-based - a folder can show
  "working" while still missing edge-case handling. Cross-check against
  root PROGRES.md for what's actually been verified end-to-end vs. only
  passed tsc --noEmit.
