# ARCLUX — Progress Summary

> Paste file ini ke awal chat Claude manapun (atau `cat PROGRES.md`) supaya
> Claude langsung paham status project tanpa perlu dijelasin ulang dari nol.
> Update file ini setiap kali ada progress besar.
>
> Cek status kosong terkini:
> ```bash
> cd ~/arclux
> find apps packages scripts tests -type f \( -name "*.ts" -o -name "*.tsx" \) \
>   -not -path "*/node_modules/*" | while read f; do
>   echo "$(wc -l < "$f") $f"
> done | sort -n
> ```
> Threshold: file dengan header lisensi Apache 2.0 baseline-nya **8 baris**,
> bukan 0 — jadi "kosong" berarti ≤9 baris, bukan `==0`. Selalu `cat` file
> yang mencurigakan sebelum percaya angka `wc -l` doang.

## Apa ini

ARCLUX = tool analisis codebase. Clone repo → parse → index → build dependency
graph → visualisasi interaktif di browser. Target: liat gimana file/module
saling terhubung, apa yang kena dampak kalau ubah sesuatu, dan convention apa
yang dilanggar (misal "nambah page Next.js tapi lupa daftarin route").

## Stack

- Monorepo: `apps/web` (Next.js 16, App Router, Webpack — **bukan** Turbopack,
  gak support di Termux arm64), `packages/*` (logic inti, framework-agnostic)
- UI: React, Tailwind v4, shadcn/ui (Base UI variant) + Aceternity + Magic UI
- Graph render: SVG + `d3-force` (physics layout)
- Parsing: TypeScript Compiler API (TS/TSX) + `web-tree-sitter` (Python)
- Environment: Termux di Android, bukan desktop
- Lisensi: Apache 2.0 (`LICENSE` + `NOTICE` di root, header per-file)

---

## ✅ SELESAI — pipeline & core
Satu entry point: `packages/engine/pipeline.ts` → `analyzeRepository({ repoUrl })`.
Jangan panggil step individual dari luar `engine/`.

- `packages/git/cloneRepository.ts`, `cleanupRepository.ts`, `readGitignore.ts`
- `packages/parser/core/*` (`ParserInterface`, `ParserRegistry`, `scanFiles`,
  `LanguageDetector`)
- `packages/parser/typescript/parseTs.ts` (194 baris) — **catatan**:
  `parseTsx.ts` dan `parseTsConfig.ts` masih stub kosong terpisah, TSX
  kemungkinan udah di-handle di `parseTs.ts` yang sama — cek dulu sebelum
  asumsi TSX belum bisa diparse sama sekali.
- `packages/parser/python/*` — `parsePython.ts`, `highlightPython.ts`,
  `pythonHighlightQuery.ts` (lihat detail gotcha di bawah)
- `packages/indexer/buildIndex.ts`, `resolveAliases.ts`
- `packages/graph/buildDependencyGraph.ts`, `buildFolderGraph.ts`,
  `resolvePath.ts`, `serializeGraph.ts`
- `packages/repository/*` (`Repository`, `Module`, `File`, `Folder`, `Node`,
  `Edge`, `Dependency`, `Graph`)
- `packages/engine/detectRepositoryMeta.ts`
- `packages/rules/RuleEngine.ts` + `rules/nextjs/requirePage.ts`
- `packages/shared/*` (`types.ts`, `errors.ts`, `hash.ts`, `paths.ts`,
  `constants.ts`, `logger.ts`, `utils.ts`)
- `packages/search/fuzzyScore.ts` — adaptasi dari `cmdk` (lihat NOTICE)

## ✅ SELESAI — detectors (2/18)

1. `detectCircularDependency.ts` — DFS cycle detection, adaptasi `madge`
2. `detectUnusedExports.ts` — adaptasi strategi traversal `knip`, re-implement
   total pakai `ResolvedImport`/`resolvedReExports` di `ModuleInfo`
   - **Batasan**: gak ada reference-extraction pass (cuma bisa deteksi
     "gak pernah di-import", bukan "di-import tapi gak dipake"). Namespace
     import dianggap otomatis "pake semua". Aliased re-export gak ke-chain
     bener (`RawExport` cuma simpen nama akhir). Belum entry-file-aware
     (`resolveRoutes.ts` masih kosong → false positive di file kayak
     Next.js `page.tsx`).

**16 sisanya masih 0%**: `detectComponentConvention`, `detectDeadCode`,
`detectDuplicateModules`, `detectEntryPoints`, `detectFeatureStructure`,
`detectIndexFiles`, `detectLargeModules`, `detectLayerViolation`,
`detectMissingExports`, `detectOrphanFiles`, `detectRepositoryPattern`,
`detectRouteConvention`, `detectSharedModules`, `detectStoryConvention`,
`detectTestConvention`, `detectUnusedFiles`.

## ✅ SELESAI — UI: graph viewer

Composition root: `GraphViewport.tsx` (dipakai di
`app/[org]/[repo]/graph/page.tsx`, jangan panggil `GraphCanvas` manual).

`GraphProvider` (state terpusat: transform, positions, dimensions,
contextMenuNodeId — `GraphCanvas` satu-satunya yang nulis), `GraphCanvas`
(260 baris, pan/zoom/Escape-deselect/double-click-zoom/event delegation),
`GraphToolbar`, `GraphLegend`, `GraphSearch` (73 baris, masih exact/substring
match — belum pakai `fuzzyScore.ts`), `GraphSelection`, `GraphContextMenu`,
`Minimap`, `GraphNode`, `GraphEdge`.

**Belum diverifikasi visual di browser** (cuma lolos `tsc --noEmit`):
- `Minimap` viewport-rect masih asumsi origin transform di (0,0)
- `Minimap` + `GraphLegend` bentrok kalau dirender bareng (sama-sama
  `bottom-4 right-4` absolute) — saat ini cuma `GraphLegend` yang di-render
- Double-click-zoom + context menu barengan belum dites di device nyata

## ✅ SELESAI — UI: layout, primitives, patterns (sebagian), marketing

**`components/layout/*`** (7 file, semua production-quality): `Sidebar.tsx`,
`SplitPane.tsx` (resizable pane, pointer drag), `WorkspaceLayout.tsx`,
`Navbar.tsx`, `Breadcrumbs.tsx`, `PageContainer.tsx`, `PageHeader.tsx`,
`Footer.tsx`.

**`components/primitives/*`** (7 file): `Avatar.tsx`, `Badge.tsx`,
`Checkbox.tsx`, `Kbd.tsx`, `Skeleton.tsx`, `Switch.tsx` — thin re-export dari
`vendor-ui/shadcn/*`. Semua sudah lengkap.

**`components/patterns/*`** — cuma **3 dari 11** yang selesai:
`CommandPalette.tsx` (pakai `cmdk` sebagai dependency, lihat NOTICE),
`LoadingState.tsx`, `ErrorState.tsx`. **8 sisanya masih stub**:
`ConfirmDialog`, `CopyButton`, `DataTable`, `EmptyState`, `FilterBar`,
`MobileBottomSheet`, `SearchInput`, `StatusDot`.

**`components/marketing/*`** (5 file, semua selesai): `Hero.tsx`, `CTA.tsx`,
`Example.tsx`, `Features.tsx`, `Footer.tsx`.

**`components/overview/*`** — cuma `ProjectStructure.tsx` (99 baris, file
tree UI collapsible pakai `d3-hierarchy`) yang selesai. `RepositoryHeader`,
`RepositoryInfo`, `RepositoryOverview` masih stub.

**`components/explorer/*`** — cuma `FileDetails.tsx` (132 baris, fetch +
render source dengan syntax highlight) yang selesai, **belum di-wire ke
halaman manapun** karena `Explorer.tsx` sendiri masih stub. `DependencyList`,
`ImpactSummary` juga masih stub.

**`hooks/useTheme.ts`** (36 baris) selesai. `useClipboard`,
`useCommandPalette`, `useDebounce`, `useMediaQuery` masih stub.

**`theme/colors.ts`, `theme.dark.ts`, `graphColors.ts`** selesai.
`motion.ts`, `spacing.ts`, `typography.ts` masih stub.

**`lib/utils.ts`, `lib/cn.ts`** selesai. `lib/api.ts`, `lib/graph.ts` stub.

**App routes**: semua `page.tsx`/`error.tsx`/`loading.tsx` di
`app/[org]/[repo]/*` udah ada isinya (bukan default Next.js boilerplate),
termasuk `app/new/page.tsx`.

**API routes**: `POST /api/analyze`, `GET /api/graph`, `GET /api/file`
(fetch raw dari GitHub + highlight Python) — semua selesai (65-84 baris).
`api/impact/route.ts` dan `api/search/route.ts` masih stub 8 baris.

## ✅ SELESAI — vendor-ui

Semua isi `vendor-ui/shadcn/*` (avatar, badge, button, checkbox,
command, dialog, dropdown-menu, input, input-group, popover, select,
separator, sheet, skeleton, switch, tabs, textarea, toast, tooltip),
`vendor-ui/aceternity/*` (5 file), `vendor-ui/magic-ui/*` (6 file, termasuk
`file-tree.tsx` 511 baris — file terbesar di seluruh project), dan
`vendor-ui/_inbox/*` (4 file custom: neon-glow-card, code-block-terminal,
graph-particles-bg, keyboard-shortcut-hint) — semua terinstall/tertulis
lengkap.

---

## ⚠️ SEBAGIAN / PERLU VERIFIKASI

**Python parsing & syntax highlighting** — jalan (`parsePython.ts` 203
baris, `highlightPython.ts` 142 baris, `pythonHighlightQuery.ts` 151 baris
disalin verbatim dari `tree-sitter-python`, MIT — atribusi ada di NOTICE),
tapi:
- Belum pernah dites end-to-end lewat `ParserRegistry` beneran (cuma script
  eksperimen terpisah)
- Belum diverifikasi visual di browser (warna syntax highlight belum
  pernah diliat beneran nempel ke karakter yang benar)
- `FileDetails.tsx` yang makai ini belum di-wire ke halaman manapun

**Gotcha `web-tree-sitter`** (WAJIB dibaca sebelum nambah parser bahasa lain
pakai tree-sitter):
- Versi **wajib 0.25.0**, bukan 0.26.x — versi baru gagal load WASM grammar
  (`getDylinkMetadata` ABI mismatch)
- Harus dipanggil via `require()` (lewat `createRequire(import.meta.url)`),
  bukan `import` murni — error "Dynamic require of fs/promises is not
  supported" kalau dipaksa `import`
- Gak ada `.d.ts`, gak bisa di-augment via `declare module` (error TS2665)
  — solusinya type custom sendiri (`TSNode` interface), require sebagai `any`
- Grammar `.wasm` per-bahasa ada di `node_modules/tree-sitter-wasms/out/`,
  BUKAN dari clone `~/research/tree-sitter` (itu cuma referensi konsep)
- Parser instance WAJIB singleton (`getPythonRuntime()` pola
  promise-cache) — reload WASM per-`parse()` call bakal sangat lambat
- Query constructor beda 2 versi API (`language.query()` lama vs
  `new Query()` baru) — `highlightPython.ts` udah handle fallback
- Python gak punya `export` — semua top-level `function_definition`/
  `class_definition` dianggap "export" (heuristic, belum baca `__all__`)

**`packages/detectors/detectUnusedExports.ts`** — lihat batasan di section
detectors di atas.

---

## ❌ MASIH KOSONG (stub 8 baris, cuma header lisensi)

**Prioritas #1 — fitur inti, 0% total**: `packages/impact/*` (8 file:
`buildImpactTree`, `calculateAffectedComponents/Files/Modules/Routes`,
`traceConsumers/Dependencies/Exports/Imports`)

**Prioritas tinggi**:
- `apps/cli/*` (6 file: `analyze`, `config`, `doctor`, `graph`, `impact`, `index`)
- `packages/db/*` (5 file)
- `components/workspace/*` (5 file + 3 panel — semua stub)
- `components/patterns/*` — 8 dari 11 file (lihat daftar di atas)
- `components/explorer/Explorer.tsx`, `DependencyList.tsx`, `ImpactSummary.tsx`
- `components/overview/RepositoryHeader/Info/Overview.tsx`
- `components/search/GlobalSearch.tsx` (tinggal pakai `fuzzyScore.ts` yang
  udah ada)
- Detector sisanya (16/18)

**Prioritas menengah**:
- `packages/cache/*`, `packages/watcher/*` (masing-masing 5 & 4 file)
- `packages/git/*` sisanya (`checkoutBranch`, `detectDefaultBranch`,
  `getBranches`, `getCommitHistory`, `getContributors` — beda dari
  `cloneRepository`/`cleanupRepository`/`readGitignore` yang udah selesai)
- `packages/graph/buildCallGraph/buildExportGraph/buildImportGraph.ts`
- `packages/indexer/*` sisanya (`indexSchema`, `resolveComponents/Exports/
  Hooks/Providers/Routes`, `updateIndex`, `watchIndex`) — **`resolveRoutes.ts`
  kosong ini yang bikin `detectUnusedExports` belum entry-file-aware**
- `packages/rules/*` sisanya (electron, express, nestjs, react, vite — 9 file,
  `nextjs/*` juga masih 3 dari 4 stub: `requireIndexUpdate`,
  `requireLayoutUpdate`, `requireMetadata`)
- `packages/search/*` (SearchEngine, SearchFilters, SearchIndex,
  SearchKeyboard, SearchProvider, SearchResults — beda dari `fuzzyScore.ts`
  yang udah selesai, ini belum dipakein)
- `packages/ui/*` (5 file) — ⚠️ **hati-hati duplikasi**: `graphColor.ts` di
  sini vs `theme/graphColors.ts` di `apps/web` yang udah selesai, nama mirip
  banget, resiko dead-code kayak kejadian sebelumnya kalau ada yang nulis ke
  sini tanpa sadar udah ada versi jalan
- `apps/web/features/*` (13 file — graph, impact, issues, repository, search
  stores/hooks, semua stub)
- `apps/web/hooks/*` sisanya (useClipboard, useCommandPalette, useDebounce,
  useMediaQuery)
- `apps/web/lib/api.ts`, `lib/graph.ts`
- `apps/web/theme/motion.ts`, `spacing.ts`, `typography.ts`
- Parser bahasa lain: cpp, csharp, go, java, javascript (parseCommonJs/Js/Jsx),
  php, ruby, rust — semua 0%. `parser/config/*` (json, packageJson, toml,
  yaml) juga 0%. `parser/core/parseImports.ts` 0%.
- `parser/typescript/parseTsx.ts`, `parseTsConfig.ts` — cek dulu apa ini
  beneran perlu diisi terpisah atau logic-nya udah nyatu di `parseTs.ts`
  (194 baris) sebelum nulis ulang

**Prioritas rendah**:
- `scripts/*` (4 file: benchmark, build, generateFixtures, release)
- `tests/*` (semua — detector, graph, impact, indexer, pipeline, parser
  per-bahasa) — 0% total, belum ada satu test pun di project ini

---

## Referensi eksternal yang sudah dipakai

Semua atribusi lengkap ada di `NOTICE` (root). Ringkasan:

| Sumber | Lisensi | Sifat | Jadi |
|---|---|---|---|
| `sst/opencode` | MIT | pola diadaptasi ulang | `theme/arclux.json`, `hooks/useFilteredList.ts` |
| `pahen/madge` | MIT | algoritma diimplementasi ulang | `detectCircularDependency.ts` |
| `git-truck` | MIT | pola UX diimplementasi ulang | `GraphCanvas.tsx` |
| `sverweij/dependency-cruiser` | MIT | konsep diimplementasi ulang | `RuleEngine.ts` |
| `d3-hierarchy` | ISC | dipakai langsung | `buildFolderGraph.ts` |
| `webpro-nl/knip` | MIT | strategi traversal diimplementasi ulang | `detectUnusedExports.ts` |
| `tree-sitter/tree-sitter-python` | MIT | query disalin verbatim | `pythonHighlightQuery.ts` |
| `pacocoursey/cmdk` | MIT | dipakai langsung sbg dependency + scoring diadaptasi | `CommandPalette.tsx`, `fuzzyScore.ts` |

**Repo di `~/research` yang cuma buat baca pola/arsitektur, bukan dicomot
kodenya**: git, language-server-protocol, llvm-project, sqlite, tree-sitter,
nx, clack, shadcn-table, drizzle-orm (cek mana yang beneran udah di-clone
sebelum asumsi ada).

## Masalah yang pernah kejadian — jangan terulang

- **Dead code numpuk**: 2 file beda nama ngerjain hal sama
  (`graph/resolveAlias.ts` vs `indexer/resolveAliases.ts`) karena sesi kerja
  paralel tanpa sinkron. Lesson: SELALU `cat`/`grep` dulu sebelum nulis file
  baru yang berpotensi overlap. **Resiko sama masih ada** di
  `packages/ui/graphColor.ts` vs `theme/graphColors.ts` — belum di-cleanup.
- **`wc -l` menipu**: file dengan header lisensi Apache 2.0 baseline 8 baris
  meski isinya kosong. Threshold "kosong" itu `≤9`, bukan `==0`. Selalu `cat`
  file yang meragukan sebelum nyatet status di PROGRES.md.
- **Header lisensi ganda**: pernah ada file dengan 2 header (MIT lama +
  Apache baru numpuk) gara-gara ganti lisensi tengah jalan tanpa hapus
  header lama dulu. Udah dibersihin manual.
- **Script panjang bisa gagal di tengah tanpa ketauan**: sesi CommandPalette
  sempet gagal nulis file di tengah heredoc, tapi step-step sebelumnya
  (install `cmdk`, bikin `fuzzyScore.ts`) tetep sukses — bikin keliatan
  "berhasil" padahal enggak lengkap. Lesson: abis jalanin script multi-step,
  verifikasi tiap langkah (`cat` file / `git log`), jangan asumsi "dijalanin"
  = "berhasil semua".
- **Termux quirks**: `/tmp` gak ada, Turbopack gak jalan di arm64 (pakai
  `--webpack`), git push butuh Personal Access Token bukan password.
- **Repo referensi jangan ke-clone di dalam `~/arclux`** — harus di `~` root
  (`~/git-truck`, `~/madge`, `~/opencode`, `~/research/*`), di luar project.
