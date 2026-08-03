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

## ✅ SELESAI — detectors (10/18)

1. `detectCircularDependency.ts` — DFS cycle detection, adaptasi `madge`
2. `detectUnusedExports.ts` — adaptasi strategi traversal `knip`, re-implement
   total pakai `ResolvedImport`/`resolvedReExports` di `ModuleInfo`
   - **Batasan**: gak ada reference-extraction pass (cuma bisa deteksi
     "gak pernah di-import", bukan "di-import tapi gak dipake"). Namespace
     import dianggap otomatis "pake semua". Aliased re-export gak ke-chain
     bener (`RawExport` cuma simpen nama akhir). Belum entry-file-aware
     (`resolveRoutes.ts` masih kosong → false positive di file kayak
     Next.js `page.tsx`).
3. `detectOrphanFiles.ts` — file-level version dari poin 2 (nothing imports
   this file at all). Kena entry-file caveat yang sama.
4. `detectLargeModules.ts` — flag file di atas threshold byte (default
   15,000). Verified lawan repo `arclux` sendiri: 0 hasil saat ini karena
   file terbesar di repo (`file-tree.tsx`, 511 baris) cuma 12,840 bytes,
   masih di bawah threshold — bukan bug, threshold emang belum kepancing.
5. `detectDuplicateModules.ts` — group file by content hash.
   - **Insiden yang udah difix**: threshold awal (`minSizeBytes = 200`)
     kekecilan. Stub file kosong (header lisensi + 1 baris comment) di
     repo ini ternyata 263 bytes, bukan di bawah 200 kayak yang diasumsikan
     pas nulis komentarnya. Hasilnya 149 stub file ke-grouped jadi 1 fake
     "duplicate group" pas dites lawan repo asli (gak ketauan di
     `python-demo` yang cuma 6 file). Threshold dinaikin ke 300. Masih
     heuristic byte-based yang rapuh — `FileInfo` gak punya `lineCount`
     atau `content`, cuma `sizeBytes`/`hash`, jadi kalau header lisensi
     berubah format, threshold ini bisa stale lagi.
6. `detectSharedModules.ts` — flag high fan-in files (importedBy count).
   Informational, bukan "masalah". Verified: nemuin
   `packages/shared/types.ts` (25 importer), `packages/repository/Repository.ts`
   (23 importer) di repo `arclux` sendiri — masuk akal.
7. `detectIndexFiles.ts` — flag barrel file (index.ts) yang campur
   re-export dengan definisi sendiri.
   - **Catatan tumpang tindih**: `packages/repository/Module.ts` udah
     punya `isBarrelFile()`/`isEntryPoint()` yang konsepnya mirip. Belum
     dicek apa ada duplikasi logic — worth diverifikasi sebelum nulis
     detector convention berikutnya yang mungkin nyenggol area sama.

Diverifikasi 2 kali: lawan `playground/python-demo` (fixture kecil) DAN
lawan repo `arclux` sendiri lewat `npx tsx apps/cli/index.ts doctor .`
(15,630 baris kode nyata) — yang kedua ini yang nemuin bug threshold di
atas, gak ketauan dari fixture kecil doang.

8. `detectLayerViolation.ts` — rule-matching concept (from-pattern /
   to-pattern regex on folder path) adapted from sverweij/dependency-cruiser
   (MIT), src/validate/match-folder-dependency-rule.mjs. Not a port —
   dependency-cruiser supports arbitrary user-defined rules with regex
   capture groups; this is a small fixed set of 2 ARCLUX-specific rules
   (packages/* can't import apps/*, packages/shared/* can't import sibling
   packages/*) against ARCLUX's own ModuleInfo/ResolvedImport shape, no
   group-capture machinery. Verified with positive control (planted a fake
   violation, confirmed detection, reverted) — 0 violations in `arclux`
   itself currently.
9. `detectDeadCode.ts` — ARCLUX-original, NOT adapted from knip despite
   investigating knip first (knip has no "dead code" issue type at all —
   its IssueType union is granular: files/exports/types/enumMembers/etc,
   no umbrella bucket). Deliberately scoped to NOT duplicate
   detectOrphanFiles or detectUnusedExports: flags a module that IS
   imported by something (not orphaned) but where EVERY one of its own
   exports is unused (per detectUnusedExports) — i.e. likely only ever
   imported for a side effect. Composes detectUnusedExports's output
   rather than re-deriving usage data, so there's one source of truth for
   "is this export used." Verified with positive control (planted a fake
   side-effect-only import, confirmed detection, reverted) — 0 findings in
   `arclux` itself currently.

Diverifikasi juga lewat `doctor.ts` end-to-end (9/9 detector jalan bareng,
bukan cuma diuji satu-satu terisolasi) lawan `playground/python-demo` dan
lawan repo `arclux` sendiri.

10. `detectEntryPoints.ts` — ARCLUX-original, positive classifier for
    orphaned modules (importedBy === 0) that match a known entry-point
    convention (Next.js App Router page/layout/loading/error/route files,
    apps/cli/index.ts). Informational only — does not modify or suppress
    detectOrphanFiles/detectUnusedExports findings, just lists known-good
    matches alongside them for cross-checking. Verified against `arclux`
    itself: 25 findings, all correct (every app/**/page.tsx, layout.tsx,
    loading.tsx, error.tsx, route.ts under apps/web/app, plus
    apps/cli/index.ts).

Diverifikasi juga lewat `doctor.ts` end-to-end (10/10 detector jalan
bareng) lawan `playground/python-demo` dan lawan repo `arclux` sendiri.

**8 sisanya masih 0%**: `detectComponentConvention`, `detectFeatureStructure`,
`detectMissingExports`, `detectRepositoryPattern`, `detectRouteConvention`,
`detectStoryConvention`, `detectTestConvention`, `detectUnusedFiles`.

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

## Update — packages/incremental (fondasi baru, belum di-wire)

`packages/incremental/` — Cell (input), Query (memoized function dengan
dependency tracking + early cutoff), Database (koordinasi revision).
Prinsip diadaptasi dari `salsa-rs/salsa` (dual MIT/Apache-2.0) — BUKAN port
(Rust proc-macro vs runtime tracking di TS), re-implementasi dari nol.
Atribusi lengkap ada di komentar `Database.ts`.

**Diverifikasi lewat demo runnable** (`packages/incremental/demo.ts`, jalanin
`npx tsx packages/incremental/demo.ts`), bukan cuma `tsc --noEmit`:
- Memoization: call berulang tanpa perubahan = 0 recompute
- Dependency tracking: cuma Cell yang beneran dibaca yang trigger invalidation
- Early cutoff: `Cell.set()` dengan value identik (`Object.is`) = no-op,
  gak nge-bump revision
- Cycle detection: query yang re-entry ke key yang sama pas masih computing
  → throw, bukan infinite loop

**Batasan yang diketahui (didokumentasikan di komentar `Query.ts`)**:
- Early cutoff cuma jalan buat reference equality (`Object.is`) — object baru
  dengan isi identik tetap dianggap "berubah". Deep-equality cutoff butuh
  comparator custom, belum diimplementasi.
- Dependency tracking pas re-validasi cache-hit itu over-approximate (query
  C yang manggil A yang manggil B jadi depend on A DAN B langsung, bukan
  cuma A dengan B implied transitively) — aman (gak ada missed invalidation)
  tapi gak maximally minimal.
- Cycle throw, gak ada fixed-point resolution buat query yang genuinely
  rekursif — itu dianggap bug caller, bukan pattern yang didukung.

**BELUM di-wire ke pipeline manapun** — `buildIndex.ts`, `pipeline.ts`,
detector-detector, semuanya masih jalan cara lama (full re-scan). Ini
fondasi standalone yang perlu integrasi terpisah sebagai langkah besar
berikutnya, bukan otomatis kepake begitu file ini ada.

## Update — First real end-to-end verification (playground/python-demo)

`playground/python-demo/` — fixture 6 file Python (circular import, unused
export, normal chain) + `scripts/testPlayground.ts` — script manual yang
manggil `buildIndex` → `buildDependencyGraph` → 2 detector langsung,
BYPASS `analyzeRepository()` (yang didesain buat repoUrl/clone, bukan
local path). Ini exception yang legit dari aturan "jangan panggil step
individual dari luar engine/" — itu aturan buat call site produksi
(CLI, API route), bukan script verifikasi lokal.

**Hasil, pertama kali dites lawan kode nyata (bukan cuma tsc --noEmit)**:
- Module count, import resolution, graph edges — semua benar
- `detectCircularDependency` nemuin cycle `cyclic_a ↔ cyclic_b` — benar
- `detectUnusedExports` nemuin `unused_helper` (true positive) DAN
  `main` di `main.py` (false positive) — false positive ini **konfirmasi
  empiris pertama** dari limitation "belum entry-file-aware" yang udah
  dicatet sebelumnya, bukan bug baru. `resolveRoutes.ts` yang masih 0%
  itu yang bakal benerin ini.

**Catatan koordinasi**: sesi lain lagi rencanain refactor `pipeline.ts`
buat CLI `doctor` command — nambah field `findings[]` ke
`AnalyzeRepositoryResult`, biar `analyzeRepository()` orkestrasi detector
secara internal (bukan tiap caller manggil `buildIndex`+detector sendiri).
Belum ada kode yang di-commit dari rencana itu per commit `9e6b660e`.
`scripts/testPlayground.ts` di atas TIDAK menggantikan rencana itu — itu
tetap dibutuhkan buat local dev testing, sementara refactor `findings[]`
itu buat production call sites (CLI, API). Kalau nanti `findings[]`
ditambahkan, `testPlayground.ts` bisa disederhanakan buat pakai itu juga.

## Update — doctor.ts sekarang manggil 10/18 detector (updated dari 9/18)

`apps/cli/doctor.ts` di-update manggil ke-5 detector baru di atas selain
2 yang lama. Masih manual call per-detector (belum ada registry) — komentar
di file itu sendiri udah nyatet ini worth di-registry-in begitu nambah
detector ke-8+, karena tiap detector punya finding shape beda-beda
(`cycle` vs `filePath`+`line` vs `hash`+`filePaths[]` vs `isPureBarrel`),
jadi registry butuh print-adapter per detector, bukan cuma daftar fungsi.

## Update — apps/cli (5/6 file, index.ts sekarang punya isi beneran)

`apps/cli/*` — `analyze`, `doctor`, `graph`, `config` **jalan dan
diverifikasi** lawan `playground/python-demo` (bukan cuma tsc --noEmit).
`impact` sengaja jujur bilang "belum diimplementasi" — `packages/impact/*`
masih 0%, jadi command ini gak nge-fake hasil kosong/palsu.

Dibangun pakai `commander` (routing) + `@clack/prompts` (output/spinner).

**`analyzeLocal.ts`** — helper baru, manggil `buildIndex` +
`buildDependencyGraph` langsung terhadap local path, BYPASS
`analyzeRepository()` (yang didesain buat repoUrl/clone). Exception yang
sama kayak `scripts/testPlayground.ts` — legal buat local-path call site,
bukan buat production remote-repo flow.

**Action item eksplisit**: sesi lain dilaporkan lagi rencanain refactor
`pipeline.ts` (nambah `findings[]` + local-path support ke
`AnalyzeRepositoryResult`). Begitu itu landing, `analyzeLocal.ts` harus
DIHAPUS dan semua command CLI pindah manggil engine API langsung — jangan
biarin 2 jalur orkestrasi (pipeline.ts vs analyzeLocal.ts) hidup
berdampingan lebih dari sementara, itu bakal jadi dead-code-risk baru.

**Temuan tambahan**: `apps/cli` sebelumnya gak punya `tsconfig.json`
sendiri — `tsc` otomatis naik cari config ke root `~/arclux/tsconfig.json`,
yang ternyata isinya Next.js-flavored (`jsx: preserve`, `plugins: next`),
kemungkinan salah taruh/duplikat dari `apps/web/tsconfig.json`. Ini bikin
`tsc --noEmit` di CLI ikut nyisir seluruh `apps/web` dan gagal di puluhan
`@/*` import yang cuma valid di scope Next.js. Fixed dengan bikin
`apps/cli/tsconfig.json` sendiri (Node/ESNext target, self-contained
include). **Belum diselidiki**: apa root `tsconfig.json` itu emang
sengaja atau bug lama yang kebawa — worth dicek kalau nanti ada
konsumer/workspace lain yang juga gak punya tsconfig sendiri.

## KOREKSI PENTING — packages/impact/* ternyata SUDAH SELESAI (8/8)

Sebelumnya dicatat sebagai prioritas #1 yang 0% total. Ternyata sudah
diimplementasi lengkap di commit `8b69831a` (sebelum sesi ini bahkan
mulai), cuma belum pernah ke-cross-check ke PROGRES.md. Terverifikasi
lewat `cat` langsung (bukan cuma wc -l):

- `traceImports.ts` (33 baris), `traceExports.ts` (46 baris) — trace
  identifier-level, konsisten dengan pola yang sama seperti
  `detectUnusedExports.ts` (namespace/default/named import handling)
- `calculateAffectedFiles.ts` (66 baris) — base function
- `calculateAffectedModules.ts`, `calculateAffectedComponents.ts`,
  `calculateAffectedRoutes.ts` — semua compose di atas `calculateAffectedFiles`,
  bukan duplikasi logic. `Routes` bahkan convert file path ke Next.js route
  path dengan benar (strip route groups `(...)`)
- `buildImpactTree.ts` (38 baris) — **ada cycle guard** (`ancestors: Set`)
  + `maxDepth`, penting karena repo bisa punya circular import beneran
  (lihat `playground/python-demo/cyclic_a.py` ↔ `cyclic_b.py`)
- `traceDependencies.ts`, `traceConsumers.ts` — belum di-`cat` manual,
  asumsikan selesai berdasarkan pola konsisten 6 file lain, tapi **verifikasi
  ulang sebelum benar-benar mengandalkannya**

**Lesson tambahan**: ini kejadian yang PERSIS sama seperti insiden
`components/layout/*` sebelumnya — progress asli lebih maju dari yang
tercatat karena beda sesi kerja tidak saling sinkron ke PROGRES.md.
Redundansi verifikasi (`cat`, bukan asumsi dari nama file/PROGRES.md lama)
tetap wajib sebelum mulai kerja di area manapun.

**Action item**: `apps/cli/impact.ts` saat ini SALAH — bilang "not yet
implemented" padahal fungsinya sudah ada. Perlu diperbaiki supaya
benar-benar memanggil `buildImpactTree`/`calculateAffectedFiles` dkk.

## Update — detectors 18/18 (100%), 2 bug produksi BELUM difix

packages/detectors/* lengkap 18/18. Verifikasi via scripts/testPlayground.ts
(sekarang manggil semua 18 detector, jalan lawan fixture ATAU repo sendiri
lewat `npx tsx scripts/testPlayground.ts .`).

**BUG PRODUKSI, BELUM DIFIX**: detectRouteConvention nemu
apps/web/app/api/impact/route.ts DAN apps/web/app/api/search/route.ts
gak export HTTP method (GET/POST/dll) — kedua endpoint kemungkinan besar
gak jalan kalau di-hit.

Temuan lain: detectRepositoryPattern nemu package-level cycle
packages/indexer <-> packages/graph. detectMissingExports nemu 9 file
shadcn (button.tsx dkk) gak di-re-export lewat components/ui/index.ts.
detectUnusedExports masih false-positive di komponen React (belum pakai
filter detectEntryPoints kayak detectUnusedFiles).

## Update — Python resolver bug + TS export default double-count bug (fixed)

Dites lawan playground/python-demo (fixture 6 file, sudah ada sebelumnya)
dan nemuin 2 bug produksi nyata:

1. packages/graph/resolvePath.ts — bare specifier (contoh Python
   "from utils import x") selalu divonis external package tanpa nyoba
   resolve internal dulu. Bener buat JS/TS (bare = selalu npm package),
   salah buat Python (bare = sering sibling module). Juga .py belum ada
   di RESOLVABLE_EXTENSIONS dan __init__.py belum ada di INDEX_FILENAMES.
   FIXED — sekarang bare specifier dicoba sebagai same-directory file dulu
   sebelum divonis external, dan .py/__init__.py sudah masuk daftar.
   Hasil sebelum fix: graph 0 edges di python-demo. Sesudah: 6 edges,
   circular dependency kedetect benar, unused exports akurat.

2. packages/parser/typescript/parseTs.ts extractExports — "export default
   function Page()" punya modifier Default DAN Export sekaligus di node
   yang sama. Ada 2 blok if independen (bukan if/else), jadi node ini
   ke-push 2x: sekali sebagai kind "default", sekali lagi sebagai "named".
   FIXED — blok kedua di-guard dengan !isDefaultExport. Ketemu dari
   playground/nextjs-demo testing (page.tsx kehitung 2 exports, bukan 1).

Gotcha proses: 2x kejadian bash history expansion makan tanda "!" di
python3 -c "..." heredoc (event not found), sekali di README badge fix,
sekali di guard !isDefaultExport ini — walau python3 lapor "patched
successfully", isi sebenarnya rusak karena baris yang ada "!" hilang.
`set +H` di awal sesi terminal mencegah ini. SELALU re-cat file setelah
patch multi-baris yang mengandung "!", jangan percaya "patched
successfully" doang.

playground/ sekarang punya 6 fixture baru: react-demo, nextjs-demo,
express-demo, nest-demo (semua langsung testable via
scripts/testPlayground.ts), go-demo, java-demo (fixture siap, parser
untuk 2 bahasa ini belum ditulis).

## Update — Sync besar dari sesi paralel lain (baca sebelum asumsi apapun 0%)

Beberapa sesi Claude lain jalan paralel pakai akun berbeda. Progress asli
jauh lebih maju dari yang sempat tercatat di sini. Highlight:

- packages/impact/* SUDAH 8/8 selesai (traceImports, traceExports,
  calculateAffectedFiles/Modules/Components/Routes, buildImpactTree,
  traceConsumers/Dependencies) — sempat salah tercatat "0%, prioritas #1"
  di versi PROGRES.md lama. Verified via cat manual.
- packages/detectors/* SUDAH 18/18 selesai (sebelumnya tercatat 10/18).
- apps/cli/* SUDAH 5/6 (analyze, doctor, graph, config jalan + verified
  lawan python-demo, pakai commander + @clack/prompts). impact.ts ADA
  tapi salah — masih bilang "not yet implemented" padahal packages/impact
  sudah selesai. Belum diperbaiki, action item terbuka.
- apps/cli/analyzeLocal.ts — helper sementara bypass analyzeRepository()
  buat local path. Harus dihapus begitu ada dukungan local-path resmi di
  pipeline.ts (kalau itu jadi dikerjakan) — jangan biarkan 2 jalur
  orkestrasi hidup berdampingan lama-lama.
- packages/incremental/* (Cell/Query/Database, adaptasi konsep salsa-rs,
  bukan port) — fondasi selesai + verified via demo.ts runnable, TAPI
  belum di-wire ke pipeline manapun. buildIndex/pipeline/detectors semua
  masih full re-scan cara lama.
- packages/ui/graphColor.ts vs theme/graphColors.ts — dicek manual,
  graphColor.ts masih stub 8 baris kosong (bukan duplikat aktif). Resiko
  cuma muncul KALAU nanti ada yang nulis isi ke situ tanpa sadar
  theme/graphColors.ts sudah jalan. Belum perlu cleanup sekarang.

Lesson diulang lagi (sudah pernah dicatat, terbukti masih relevan): SELALU
cat manual sebelum percaya catatan lama di file ini, apalagi kalau ada
sesi lain yang mungkin jalan paralel.

## Update — /api/impact dan /api/search diimplementasi (dari stub kosong)

Ditemukan lewat dogfooding: detectRouteConvention (salah satu dari 18
detector) menemukan apps/web/app/api/impact/route.ts dan
.../search/route.ts sama sekali tidak export HTTP method apapun. Dicek
manual — ternyata bukan lupa export, dua-duanya memang masih stub 8 baris
(cuma header lisensi), belum pernah ditulis sama sekali.

Desain: AnalyzeRepositoryResult sekarang bawa field `repository` (instance
Repository penuh, BUKAN plain object). PENTING — field ini server-side
only. Repository.modules itu private Map, kalau di-JSON.stringify apa
adanya bakal jadi {} kosong secara diam-diam (bukan crash, silent data
loss). apps/web/app/api/analyze/route.ts (yang sudah lama jalan) di-patch
untuk strip field `repository` sebelum response, supaya shape JSON-nya
tidak berubah diam-diam sekarang field ini ada.

/api/impact — compose calculateAffectedFiles + buildImpactTree (dari
packages/impact yang ternyata sudah selesai, lihat update di atas).
/api/search — pakai fuzzyScore.ts (adaptasi cmdk) buat cari lewat module
file path saja. Ini stopgap, BUKAN search sungguhan — packages/search/
SearchEngine.ts dkk masih 0%.

STATUS: cuma lolos tsc --noEmit, BELUM dites end-to-end lewat dev server
beneran (analyzeRepository perlu repoUrl asli/clone, tidak bisa dites
lewat scripts/testPlayground.ts seperti kerjaan CLI/detector sebelumnya).
Test manual sebelum dipercaya: pnpm dev di apps/web, lalu curl
'localhost:3000/api/impact?repoUrl=<url>&moduleId=<path>' ke repo GitHub
kecil beneran.

## Update — file PROGRESS.md (double-S, typo) dihapus

Sempat ada file terpisah bernama PROGRESS.md (bukan PROGRES.md) dari sesi
lain yang typo nama file. Sudah dihapus — PROGRES.md (single-S) ini tetap
satu-satunya file progress resmi.
