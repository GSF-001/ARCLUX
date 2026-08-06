# apps/

Status of apps/cli and apps/web, based on a file scan (line count per
file). Threshold differs from packages/: apps/web has files that are
9-line thin re-exports (working, e.g. `export * from "@/vendor-ui/shadcn/button"`)
vs 8-line pure stubs (empty, license header only) - the two look almost
identical by line count alone, so this table is based on spot-checking 5
files across both buckets (all 5 matched: 8 = stub, 9 = working re-export),
not a `cat` of every single file. Re-verify with `cat` before trusting a
borderline file.

Re-run scan:

    find apps/cli -name "*.ts" -not -path "*/node_modules/*" | while read f; do
      echo "$(wc -l < "$f") $f"
    done | sort -n

    find apps/web -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v vendor-ui | grep -v ".next" | while read f; do
      echo "$(wc -l < "$f") $f"
    done | sort -n

## apps/cli

All 7 commands have real content (26-173 lines each, well above the
8-line stub threshold) - no stubs found.

| File | Lines | Status |
|---|---|---|
| index.ts | 26 | working |
| config.ts | 35 | working |
| analyze.ts | 36 | working |
| graph.ts | 42 | working |
| impact.ts | 69 | working |
| analyzeLocal.ts | 70 | working |
| doctor.ts | 173 | working |

## apps/web

| Folder | Purpose | Status | Notes |
|---|---|---|---|
| app/ (pages, loading, error, api routes) | Next.js App Router pages + API routes | working | all files 13-84 lines, no stubs |
| components/ui | shadcn re-export wrappers | working | 19 files, all 9-line thin re-exports to vendor-ui/shadcn |
| components/graph | Graph rendering (Canvas, Node, Edge, Provider, FocusView, etc.) | working | 14 files, 35-323 lines, no stubs |
| components/layout | Navbar, Sidebar, Breadcrumbs, SplitPane, etc. | working | 8 files, 18-79 lines |
| components/marketing | Landing page sections (Hero, CTA, DocsPanel, etc.) | working | 6 files, 32-101 lines |
| components/patterns | Reusable UI patterns (DataTable, CommandPalette, FilterBar, etc.) | working | 11 files, 22-100 lines |
| components/workspace | Workspace panels (Files, Impact, Issues, Search) | working | 8 files, 28-102 lines |
| components/primitives | Avatar, Badge, Checkbox, Kbd, Skeleton, Switch | working | 6 files, 12-22 lines |
| components/search | GlobalSearch | working | 1 file, 124 lines |
| components/explorer | DependencyList, Explorer, FileDetails, ImpactSummary | partial | FileDetails (132) and ImpactSummary (166) done; DependencyList and Explorer are 8-line stubs |
| components/overview | RepositoryHeader, RepositoryInfo, RepositoryOverview, ProjectStructure | partial | only ProjectStructure (99) done; the other 3 are 8-line stubs |
| features/graph | graphStore, graphEvents, useGraph, useGraphLayout, useGraphSelection | stub | only useGraph.ts (9-line re-export) has content; 4/5 files are 8-line stubs |
| features/impact | impactStore, useImpact | stub | both 8-line stubs |
| features/issues | issuesStore, useIssues | stub | both 8-line stubs |
| features/repository | repositoryStore, useRepository, useRepositoryInfo | stub | all 3 are 8-line stubs |
| features/search | searchStore, useSearch | stub | both 8-line stubs |
| hooks | useClipboard, useCommandPalette, useDebounce, useMediaQuery, useTheme | partial | useDebounce (32) and useTheme (40) done; useClipboard, useCommandPalette, useMediaQuery are 8-line stubs |
| lib | api.ts, cn.ts, graph.ts, utils.ts | partial | cn.ts (9, re-export) and utils.ts (14) done; api.ts and graph.ts are 8-line stubs |
| theme | colors, graphColors, motion, spacing, theme.dark, typography | partial | colors (74), graphColors (53), theme.dark (73) done; motion, spacing, typography are 8-line stubs |

## Notes

- No collaborator currently assigned to any partial/stub area here as of
  this writing.
- features/* is the biggest gap - almost entirely stub (13/14 files).
  Since components/graph, components/workspace, etc. are already working
  and presumably read data through *something*, check whether they're
  bypassing features/* stores directly or whether wiring them up to
  features/* is still pending - not determined by this scan alone.
- lib/api.ts being a stub is worth flagging specifically: if
  components/workspace or components/explorer call an API layer, check
  what they're actually importing before assuming lib/api.ts is the
  live code path.
- Percentages/status here are line-count based, not effort-based or
  runtime-verified. Cross-check against root PROGRES.md files for what's
  actually been run/tested vs. only passed tsc --noEmit.
