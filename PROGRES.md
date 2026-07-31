# ARCLUX — Progress Summary

> Paste file ini ke awal chat Claude manapun (atau `cat PROGRESS.md`) supaya
> Claude langsung paham status project tanpa perlu dijelasin ulang dari nol.
> Update file ini setiap kali ada progress besar — jangan biarin basi.

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
- Parsing: TypeScript Compiler API (baru TS/TSX, bahasa lain belum)
- Environment: ditulis & di-develop dari **Termux di Android**, bukan desktop

## Yang UDAH jalan end-to-end

```
cloneRepository() → scanFiles() → parserRegistry → buildIndex() → buildDependencyGraph()
```
Satu pintu masuk: `packages/engine/pipeline.ts` → `analyzeRepository({ repoUrl })`.
Jangan panggil step individual dari luar `engine/` — itu yang jaga lifecycle
clone/cleanup tetep bener di satu tempat.

- API: `POST /api/analyze`, `GET /api/graph?repoUrl=...`
- UI graph: `GraphProvider` (fetch+state) → `GraphCanvas` (render SVG,
  d3-force layout, pan/zoom, **Escape buat deselect, double-click buat zoom
  ke node, event delegation** — bukan onClick per-node)
- Path alias (`@/lib/api`) udah ke-resolve lewat `indexer/resolveAliases.ts`
  (baca tsconfig `paths`+`baseUrl`), dipanggil dari `graph/resolvePath.ts`
- Framework & package manager detection: `engine/detectRepositoryMeta.ts`
- Folder hierarchy: `graph/buildFolderGraph.ts` (pakai `d3-hierarchy`) →
  `components/overview/ProjectStructure.tsx` (file tree UI, collapsible)
- Detector pertama: `detectors/detectCircularDependency.ts` (DFS cycle detection)
- Rule engine fondasi: `rules/RuleEngine.ts` + contoh `rules/nextjs/requirePage.ts`

## Theme

`apps/web/theme/arclux.json` + `theme/graphColors.ts` — hybrid: base hitam
pekat ala Vercel + syntax/accent color ala OpenCode (ungu-oranye), plus token
khusus buat 6 tipe graph node (`file`, `folder`, `external-package`, `route`,
`component`, `hook`) dan 4 tipe edge. Diterapkan ke `app/globals.css` lewat
script sekali-jalan (`apply-arclux-theme.js`, udah dihapus setelah dijalanin).

## vendor-ui structure

```
vendor-ui/
├── shadcn/     ← alias "ui" di components.json nunjuk ke sini
├── aceternity/ ← install via @aceternity registry, TAPI suka nyasar ke
│                 components/ui/ dulu, harus dipindah manual tiap kali
├── magic-ui/   ← install via shadcn CLI juga, SAMA nyasar ke vendor-ui/shadcn/
│                 dulu, harus dipindah manual
└── _inbox/     ← custom, ditulis dari nol (neon-glow-card, code-block-terminal,
                  graph-particles-bg, keyboard-shortcut-hint)
```
**Gotcha**: abis `npx shadcn@latest add ...` buat vendor manapun, SELALU cek
file itu landing di folder yang bener. `aliases.ui` gak selalu dihormati oleh
registry pihak ketiga. Full detail: `apps/web/vendor-ui/README.md`.

## Kode yang diadaptasi dari open source

Semua ada attribusi di komentar kode. MIT-licensed semua.

| Sumber | Diambil | Jadi |
|---|---|---|
| `sst/opencode` | theme color tokens, pattern `use-filtered-list` (SolidJS) | `theme/arclux.json`, `hooks/useFilteredList.ts` (full rewrite ke React) |
| `pahen/madge` | algoritma DFS cycle detection | `detectors/detectCircularDependency.ts` |
| `git-truck` | UX pattern: Escape-deselect, double-click-zoom, event delegation | `GraphCanvas.tsx` v2 |
| `sverweij/dependency-cruiser` | konsep predicate-composable rule matcher | `rules/RuleEngine.ts` (fondasi ringan, bukan port penuh) |
| `d3-hierarchy` (npm resmi, dipakai git-truck) | library-nya langsung, bukan kode mereka | `graph/buildFolderGraph.ts` |

Repo lain yang di-clone tapi TIDAK dipakai (dicoba, ternyata gak relevan/gak
worth di-port): `react-force-graph` (cuma wrapper tipis), `vasturiano/force-graph`
(canvas-based, ARCLUX pakai SVG — beda paradigma, gak portable langsung),
`nx`, `codecharta` (belum dieksplor lebih jauh).

## Masalah yang PERNAH kejadian, biar gak keulang

- **Dead code numpuk**: pernah ada 2 file beda nama yang ngerjain hal sama
  (`graph/resolveAlias.ts` vs `indexer/resolveAliases.ts`, `graph/createNodes.ts`
  yang gak pernah di-wire ke `buildDependencyGraph.ts`) karena kerja bareng sesi
  Claude lain tanpa sinkron. **Semua udah dihapus/dibersihin.** Lesson: SELALU
  `cat` file yang relevan dulu sebelum nulis file baru yang mungkin overlap.
- **Termux quirks**: `/tmp` gak ada (pakai path lokal biasa), Turbopack gak
  jalan di arm64 (pakai `next build --webpack` / `next dev --webpack`),
  git push minta Personal Access Token bukan password akun.
- **Repo referensi jangan sampe ke-clone di dalam `~/ARCLUX`** — harus di `~`
  root, kalau kepencet salah posisi bakal ke-nest dan ke-track git tanpa
  sengaja. Semua ada di `~/git-truck`, `~/madge`, `~/opencode`, dll — **di
  luar** `~/ARCLUX`.

## Yang MASIH kosong (prioritas kira-kira, boleh diubah)

- `packages/impact/*` — fitur inti "apa yang kena dampak kalau file ini
  diubah", belum ada sama sekali
- `components/patterns/CommandPalette.tsx` + `hooks/useCommandPalette.ts` —
  `useFilteredList.ts` udah ada, tinggal dipakein
- `packages/detectors/*` — baru 1 dari ~18 (`detectCircularDependency`)
- `packages/search/*`, `packages/db/*`, `packages/cache/*`, `packages/watcher/*` —
  0% semua
- Parser bahasa lain (Python, Go, Java, dst) — baru TS/TSX
- `apps/cli/*` — 0%
- Banyak komponen UI level app (`workspace/`, `explorer/`) masih kosong

## Cara cek status kosong terkini

```bash
cd ~/ARCLUX
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v ".next" \
  | xargs wc -l 2>/dev/null | sort -n | awk '$1==0 {print}' | grep -v total
```

## Update — Graph components lengkap

Melanjutkan dari GraphCanvas v2 (git-truck UX pattern). Yang ditambahin:

- **State terpusat**: `transform` (pan/zoom), `positions` (hasil d3-force),
  `dimensions` (ukuran canvas), dan `contextMenuNodeId` semua dipindah dari
  `useState` lokal di `GraphCanvas` ke `GraphProvider` context. `GraphCanvas`
  sekarang satu-satunya yang **nulis** ke state itu, komponen lain baca doang.
  Alasan: `Minimap` butuh `positions`+`dimensions` juga tapi jangan sampai
  itung ulang d3-force simulation dua kali (mahal & bisa beda hasil).
- **7 komponen baru** (semua konsumsi `useGraphContext()`):
  - `GraphToolbar.tsx` — zoom in/out/reset, nampilin persen zoom
  - `GraphLegend.tsx` — legend warna node type & edge type (dari `theme/graphColors.ts`)
  - `GraphSearch.tsx` — search box, filter node by label, klik hasil → fokus+zoom ke node
  - `GraphSelection.tsx` — panel detail node yang dipilih (incoming/outgoing edge count)
  - `GraphContextMenu.tsx` — klik kanan node → Focus / Copy path / Close
  - `Minimap.tsx` — preview kecil semua node + kotak indikator viewport aktif
  - `GraphViewport.tsx` — **composition root baru**, ngerakit Provider + Canvas +
    semua komponen di atas jadi satu. Ini yang harusnya dipakai di
    `app/[org]/[repo]/graph/page.tsx`, bukan manggil `GraphCanvas` manual.

**Gotcha baru**: `Minimap` dan `GraphLegend` sama-sama nempatin diri di
`bottom-4 right-4` (CSS absolute) — bentrok kalau dua-duanya dirender
bareng. Sekarang `GraphViewport` cuma render `GraphLegend`, `Minimap` belum
dipasang di situ. Kalau mau dua-duanya tampil, perlu disusun jadi stack
vertikal dulu sebelum di-mount bareng.

**Yang belum sempat dites di browser beneran** (cuma lolos `tsc --noEmit`,
belum pernah `next dev` dan diliat visualnya):
- Minimap viewport-rect masih pendekatan kasar, asumsi origin transform di (0,0)
- Belum ada testing behavior double-click zoom + context menu barengan di device nyata

## Yang MASIH kosong (update)

Semua yang tercatat sebelumnya masih berlaku, KECUALI graph components
(`components/graph/*`) sekarang udah lengkap semua — pindahin dari "belum"
ke "udah". Prioritas berikutnya tetap:
- `packages/impact/*` — masih 0%
- `apps/cli/*` — masih 0%
- `packages/detectors/*` — masih 1/18
- `components/workspace/*`, `components/explorer/*` — masih 0%
