# ARCLUX — Context Brief

> Tempel file ini di awal SETIAP sesi Claude baru. Ini ringkasan kurasi,
> bukan arsip. Detail lengkap tetap ada di progres/*.md dan PROGRES.md —
> buka file itu HANYA kalau context brief ini gak cukup jawab pertanyaan.
> File ini di-OVERWRITE tiap akhir sesi (bukan di-append) — buang yang
> udah gak relevan, masukin yang baru. Target selalu di bawah ~200 baris.

## Apa ini
ARCLUX = tool analisis codebase. Clone repo → parse → index → build
dependency graph → visualisasi interaktif di browser. Filosofi:
"workspace, bukan dashboard" — hindari istilah HealthScore/Analytics/
Dashboard.

## Stack & environment
- Monorepo: apps/web (Next.js 16, App Router, **Webpack bukan Turbopack**
  — gak support Termux arm64), packages/* (framework-agnostic)
- Package manager: **pnpm** (bukan npm)
- Parsing: TypeScript Compiler API (TS/TSX) + web-tree-sitter (Python)
- Graph render: SVG + d3-force
- Environment: **Termux di Android** — gak ada `/tmp`, pakai `~` sebagai
  gantinya
- Lisensi Apache 2.0 — file stub baseline-nya 8 baris (header lisensi),
  bukan 0 baris, jadi "kosong" = ≤9 baris bukan `==0`

## Arsitektur ringkas
packages/git, parser (27 bahasa: TS/JS via Compiler API, sisanya web-tree-sitter
— bash/c/dart/elixir/elm/kotlin/lua/objc/ocaml/rescript/scala/solidity/swift/vue/
zig + ts/py/js/go/java/php/ruby/rust/cpp/csharp; shared loader di
core/treeSitterLoader.ts + factory config-driven makeTreeSitterParser.ts;
wasm elm di-vendor di packages/parser/wasms/ karena versi npm outdated ABI 12;
manifest parsers: package.json/go.mod/Cargo.toml/Gemfile/composer/csproj/gradle/
pom/requirements; PHP route-file parser parsePhpRoutes), indexer (buildIndex,
resolveRoutes/Exports/Components/Hooks/Providers — getEntryModuleIds dipakai
detector entry-point filter), graph (buildDependencyGraph/ImportGraph/
ExportGraph/FolderGraph/CallGraph — call graph selesai issue #50), engine
(pipeline.ts = satu-satunya entry point analyzeRepository, localPath ATAU
repoUrl), detectors (20 detector file, semua wired ke apps/cli/doctor.ts;
unusedExports/orphanFiles sudah entry-point-aware issue #4), rules (14:
nextjs/nestjs/express/vite/electron/react/laravel), search (SearchEngine/
SearchIndex/SearchFilters + /api/search — issue #9), impact (8/8
selesai), repository, db (client + schema v1 + 3 store CRUD lengkap,
dipakai daemon), cache (CacheProvider+memoryCache+3 content cache,
semua wired), incremental/watcher (built,
watchRepository wraps pipeline API, belum ada consumer), dsl (lexer/ast/
parser/runtime/bindings/script — `arclux script <file.arclux>`, registry-driven
auto-discovery: extensions()/checkids() tumbuh sendiri saat parser/detector
baru di-register), shared/types.ts (kamus tipe wajib dipakai semua package).
apps/web punya: /api/audit+security+verify+script+health+callgraph
(parity routes), halaman /[org]/[repo]/audit (AuditWorkspace: STREAM ×
FOCUS × GRAPH), /script = playground TUI opencode-style (slash palette,
highlight, JSON tree), nav registry lib/navigation.ts → sidebar+bottom
bar+Ctrl+K palette satu sumber, useGraphAuditOverlay (halo severity di
graph 3D via fgRef, zero core diff), JetBrains Mono, ViewModeToggle.
apps/web/components: graph/ (GraphCanvas, GraphProvider, GraphFocusView,
GraphAuditOverlay),
explorer/, workspace/, overview/, vendor-ui/ (shadcn+aceternity+magic-ui);
hooks/useDebounce+useTheme+useClipboard+useCommandPalette+useMediaQuery
(issue #147).

## Yang udah solid — jangan disentuh tanpa alasan kuat
- packages/engine/pipeline.ts (satu entry point, jangan panggil step
  individual dari luar engine/)
- Parser TS/Python/JS/Go/Java + manifest parsers (semua di-wire ke
  parserRegistry/manifestRegistry di pipeline.ts)
- 20 detector file, GraphCanvas/GraphProvider/GraphFocusView (history nav
  + expand-on-demand udah di-fix & diverifikasi browser)
- Call graph (buildCallGraph), search engine (packages/search), 14 rules
  (termasuk laravel/requireController), 3 web hooks baru, DSL lengkap

## GOTCHA KRITIS — baca ini sebelum debug apapun
1. **`nodeRequire.resolve()` TIDAK BISA DIPERCAYA di runtime webpack
   Next.js** — balikin path relatif ke lokasi bundle, bukan absolute
   filesystem path. Ini udah bikin bug yang sama 2x (sekali asli, sekali
   regresi pas "cleanup"). Kalau butuh resolve path native asset
   (`.wasm`, dll) di server-side Next.js code, JANGAN pakai
   `nodeRequire.resolve()` sama sekali — build path dari `process.cwd()`.
2. **Next.js dev server port suka geser + zombie process numpuk.**
   Kalau curl/test dapet response kosong/aneh, JANGAN asumsi itu bug
   kode — cek dulu `ps aux | grep node` (harus kosong sebelum start
   ulang) dan pastiin port yang dites PERSIS sama dengan yang muncul di
   baris `Local: http://localhost:XXXX`. Ini penyebab kebingungan
   paling sering sepanjang sesi-sesi kemarin.
3. **Selalu `cat` file dulu sebelum patch** — jangan asumsi isi file
   dari draft/issue/percakapan sebelumnya, walau keliatan "pasti sama".
   File bisa udah berubah dari sesi lain / PR lain.
4. Patch pakai python3 heredoc + verifikasi `anchor count == 1` sebelum
   nulis (abort kalau 0 atau >1) — pola aman yang udah terbukti.
   `set +H` dulu di awal sesi biar bash gak makan karakter `!` di
   heredoc.
5. Error yang ketangkep `ArcluxError` di API routes **gak otomatis
   ke-log** ke server console — kalau debug error yang gak keliatan di
   log, cek dulu apa error-handling-nya sengaja skip `console.error`.
6. Testing lewat `tsx` langsung (`analyzeRepository`/`buildIndex`)
   SKIP TOTAL webpack — itu cuma buktiin logic Node-nya bener, BUKAN
   buktiin jalan di runtime Next.js beneran. Dua-duanya harus dites
   terpisah, bug bisa ada di salah satu doang.
7. Komponen yang progress notes-nya bilang "typecheck-only, belum
   diverifikasi visual" — anggap serius kalau ada bug report soal itu,
   walau kodenya "kelihatan" udah bener pas dibaca.
8. `wasmPath` sekarang hardcoded ke struktur pnpm
   (`node_modules/.pnpm/tree-sitter-wasms@VERSION/...`) — bakal patah
   kalau pindah ke npm/yarn.

## Prioritas aktif sekarang
1. True per-file incremental — `packages/incremental` (Cell/Database/Query,
   reactive) + `watcher` built dan verified standalone, tapi `buildIndex`
   masih full rebuild tiap kali; `watchRepository` udah dipakai daemon
   via DaemonRepositoryWatcher (coarse dulu, per-file deferred — keputusan #6)
2. `apps/web/lib/api.ts`/`graph.ts` — beberapa komponen (ImpactSummary,
   GlobalSearch) masih inline `fetch()`, belum consume `fetchJson()`
3. Docs sync — README/ABOUT/CONTEXT/docs-site harus ikut perubahan
   parser (27 bahasa), DSL, dan fitur baru tiap PR besar (sync besar
   terakhir 08-21, PR #532)
4. 5 packages masih header-only stub: observation, services,
   package-manager, ui, web-intake — arah platform, belum ada konsumen

## Yang udah wired (jangan dikira stub lagi — audit 08-21)
- `packages/db` — client + schema v1 + 3 store (RepoStore/AnalysisStore/
  IssueStore, CRUD lengkap), DIPAKAI daemon (`saveRepo`/`saveAnalysis`
  per re-analysis, apps/cli/daemon.ts:21-22)
- `packages/cache` — CacheProvider (getCacheStats/clearAllCaches) +
  MemoryCache class implementasi beneran; fileCache/repositoryCache/
  graphCache wired di pipeline
- `packages/watcher` — watchRepository/changeQueue, dipakai daemon

## Kalau butuh detail lebih dalam
`cat PROGRES.md progres/PROGRES-status-*.md progres/bugs.md progres/decisions.md progres/gotchas.md progres/collaborators.md`
— progres/ tetap arsip lengkap, JANGAN dihapus/dipangkas.
