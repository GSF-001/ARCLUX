#!/usr/bin/env bash
# scaffold.sh — generate struktur folder + file kosong project ARIES
# Cara pakai di Termux:
#   1. pkg install git -y   (kalau belum ada)
#   2. taro script ini ke dalam folder repo kosong lu
#   3. chmod +x scaffold.sh
#   4. ./scaffold.sh
#   5. git add . && git commit -m "scaffold: initial structure" && git push

set -e

# Script ini generate struktur LANGSUNG di folder tempat dia dijalankan
# (jadi jalankan dari dalam root repo yang sudah di-clone, bukan dari luar)

# --- helper: bikin file kosong beserta parent dir-nya ---
f() { mkdir -p "$(dirname "$1")"; touch "$1"; }

# ================= apps/web =================
f apps/web/app/page.tsx
f apps/web/app/layout.tsx
f apps/web/app/globals.css
f apps/web/app/new/page.tsx
f "apps/web/app/[org]/[repo]/page.tsx"
f "apps/web/app/[org]/[repo]/graph/page.tsx"
f "apps/web/app/[org]/[repo]/search/page.tsx"
f "apps/web/app/[org]/[repo]/settings/page.tsx"
f apps/web/app/api/analyze/route.ts
f apps/web/app/api/graph/route.ts
f apps/web/app/api/impact/route.ts
f apps/web/app/api/search/route.ts

f apps/web/theme/colors.ts
f apps/web/theme/typography.ts
f apps/web/theme/spacing.ts
f apps/web/theme/motion.ts
f apps/web/theme/globals.css
f apps/web/theme/theme.dark.ts

# components/primitives
for name in Button Input Textarea Select Checkbox Switch Badge Avatar Tooltip Popover Dialog Dropdown Tabs Skeleton Kbd Separator Toast; do
  f "apps/web/components/primitives/${name}.tsx"
done

# components/patterns
for name in SearchInput CommandPalette MobileBottomSheet EmptyState ErrorState LoadingState ConfirmDialog FilterBar DataTable CopyButton StatusDot; do
  f "apps/web/components/patterns/${name}.tsx"
done

# components/layout
for name in Navbar WorkspaceLayout SplitPane PageContainer PageHeader Footer; do
  f "apps/web/components/layout/${name}.tsx"
done

# components/graph
for name in GraphCanvas GraphProvider GraphNode GraphEdge GraphLegend GraphSearch GraphContextMenu GraphSelection GraphViewport Minimap GraphToolbar; do
  f "apps/web/components/graph/${name}.tsx"
done

# components/overview
for name in RepositoryHeader RepositoryOverview ProjectStructure RepositoryInfo; do
  f "apps/web/components/overview/${name}.tsx"
done

# components/workspace
for name in Workspace WorkspaceHeader WorkspaceSwitcher WorkspaceSearch WorkspaceCommand; do
  f "apps/web/components/workspace/${name}.tsx"
done
for name in FilesPanel ImpactPanel IssuesPanel; do
  f "apps/web/components/workspace/panels/${name}.tsx"
done

# components/explorer
for name in Explorer DependencyList FileDetails ImpactSummary; do
  f "apps/web/components/explorer/${name}.tsx"
done

f apps/web/components/search/GlobalSearch.tsx

for name in Hero Example Footer; do
  f "apps/web/components/marketing/${name}.tsx"
done

# features
for name in useRepository useRepositoryInfo repositoryStore; do
  f "apps/web/features/repository/${name}.ts"
done
for name in useGraph useGraphSelection useGraphLayout graphStore graphEvents; do
  f "apps/web/features/graph/${name}.ts"
done
for name in useIssues issuesStore; do
  f "apps/web/features/issues/${name}.ts"
done
for name in useSearch searchStore; do
  f "apps/web/features/search/${name}.ts"
done
for name in useImpact impactStore; do
  f "apps/web/features/impact/${name}.ts"
done

# vendor-ui
f apps/web/vendor-ui/README.md
for name in button input dialog dropdown-menu popover tabs tooltip command select separator sheet toast; do
  f "apps/web/vendor-ui/shadcn/${name}.tsx"
done
for name in background-beams spotlight card-hover-effect text-generate-effect infinite-moving-cards bento-grid glowing-stars; do
  f "apps/web/vendor-ui/aceternity/${name}.tsx"
done
for name in animated-beam marquee shimmer-button dock border-beam number-ticker animated-list file-tree; do
  f "apps/web/vendor-ui/magic-ui/${name}.tsx"
done
for name in neon-glow-card code-block-terminal graph-particles-bg keyboard-shortcut-hint; do
  f "apps/web/vendor-ui/_inbox/${name}.tsx"
done

# hooks & lib
for name in useCommandPalette useTheme useMediaQuery useDebounce useClipboard; do
  f "apps/web/hooks/${name}.ts"
done
for name in api graph cn utils; do
  f "apps/web/lib/${name}.ts"
done

# ================= apps/cli =================
for name in index analyze graph impact doctor config; do
  f "apps/cli/${name}.ts"
done

# ================= packages/git =================
for name in cloneRepository checkoutBranch readGitignore getCommitHistory getContributors getBranches detectDefaultBranch cleanupRepository; do
  f "packages/git/${name}.ts"
done

# ================= packages/parser =================
for name in ParserRegistry LanguageDetector ParserInterface scanFiles parseImports; do
  f "packages/parser/core/${name}.ts"
done
for name in parseJs parseJsx parseCommonJs; do
  f "packages/parser/javascript/${name}.ts"
done
for name in parseTs parseTsx parseTsConfig; do
  f "packages/parser/typescript/${name}.ts"
done
for name in parsePython parseRequirements; do
  f "packages/parser/python/${name}.ts"
done
for name in parseJava parseGradlePom; do
  f "packages/parser/java/${name}.ts"
done
for name in parseGo parseGoMod; do
  f "packages/parser/go/${name}.ts"
done
for name in parseCSharp parseCsproj; do
  f "packages/parser/csharp/${name}.ts"
done
for name in parsePhp parseComposer; do
  f "packages/parser/php/${name}.ts"
done
for name in parseRuby parseGemfile; do
  f "packages/parser/ruby/${name}.ts"
done
for name in parseRust parseCargoToml; do
  f "packages/parser/rust/${name}.ts"
done
for name in parseCpp parseCMake; do
  f "packages/parser/cpp/${name}.ts"
done
for name in parseJson parseYaml parseToml parsePackageJson; do
  f "packages/parser/config/${name}.ts"
done

# ================= packages/indexer =================
for name in buildIndex updateIndex watchIndex resolveExports resolveAliases resolveRoutes resolveComponents resolveHooks resolveProviders indexSchema; do
  f "packages/indexer/${name}.ts"
done

# ================= packages/watcher =================
for name in watchRepository watchGit watchFilesystem changeQueue; do
  f "packages/watcher/${name}.ts"
done

# ================= packages/rules =================
for name in requirePage requireRoute requireLayoutUpdate requireMetadata requireIndexUpdate; do
  f "packages/rules/nextjs/${name}.ts"
done
for name in requireHookRules requirePropsTyping requireComponentExport; do
  f "packages/rules/react/${name}.ts"
done
for name in requireModuleRegistration requireControllerBinding; do
  f "packages/rules/nestjs/${name}.ts"
done
f packages/rules/express/requireRouteRegistration.ts
f packages/rules/vite/requireEntryConfig.ts
for name in requireMainProcessBinding requirePreloadExposure; do
  f "packages/rules/electron/${name}.ts"
done

# ================= packages/graph =================
for name in buildDependencyGraph buildImportGraph buildExportGraph buildCallGraph buildFolderGraph resolveAlias resolvePath createNodes createEdges serializeGraph; do
  f "packages/graph/${name}.ts"
done

# ================= packages/search =================
for name in SearchEngine SearchIndex SearchProvider SearchResults SearchFilters SearchKeyboard; do
  f "packages/search/${name}.ts"
done

# ================= packages/engine =================
for name in analyzeRepository analyzeFile analyzeModule analyzeImpact analyzeConvention analyzeArchitecture analyzeDependency generateSummary generateReport pipeline; do
  f "packages/engine/${name}.ts"
done

# ================= packages/detectors =================
for name in detectCircularDependency detectUnusedFiles detectUnusedExports detectMissingExports detectDeadCode detectDuplicateModules detectOrphanFiles detectLargeModules detectEntryPoints detectSharedModules detectRepositoryPattern detectFeatureStructure detectLayerViolation detectIndexFiles detectComponentConvention detectRouteConvention detectTestConvention detectStoryConvention; do
  f "packages/detectors/${name}.ts"
done

# ================= packages/impact =================
for name in calculateAffectedFiles calculateAffectedModules calculateAffectedRoutes calculateAffectedComponents traceImports traceExports traceDependencies traceConsumers buildImpactTree; do
  f "packages/impact/${name}.ts"
done

# ================= packages/repository =================
for name in Repository Module File Folder Dependency Edge Node Graph; do
  f "packages/repository/${name}.ts"
done

# ================= packages/db =================
for name in schema client; do
  f "packages/db/${name}.ts"
done
mkdir -p packages/db/migrations
for name in RepoStore AnalysisStore IssueStore; do
  f "packages/db/repositories/${name}.ts"
done

# ================= packages/cache =================
for name in CacheProvider fileCache graphCache repositoryCache memoryCache; do
  f "packages/cache/${name}.ts"
done

# ================= packages/shared =================
for name in constants logger errors hash paths types utils config; do
  f "packages/shared/${name}.ts"
done

# ================= packages/ui =================
for name in graphLayout graphTheme graphColor graphAnimation graphIcons; do
  f "packages/ui/${name}.ts"
done

# ================= playground =================
for name in nextjs-demo express-demo nest-demo react-demo python-demo go-demo java-demo; do
  mkdir -p "playground/${name}"
  touch "playground/${name}/.gitkeep"
done

# ================= scripts =================
for name in build release benchmark generateFixtures; do
  f "scripts/${name}.ts"
done

# ================= tests =================
for name in javascript typescript python java go rust; do
  f "tests/parser/${name}.test.ts"
done
for name in graph impact detector indexer pipeline; do
  f "tests/${name}.test.ts"
done

# ================= root files =================
f package.json
f turbo.json
f tsconfig.json
f pnpm-workspace.yaml
f README.md

echo "✅ Struktur ARIES selesai dibuat di folder ini."
