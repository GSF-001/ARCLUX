
## Update — repo rename, license fix, incremental engine, referensi baru

- **Repo GitHub udah rename ke `ARCLUX`** (uppercase). Remote lokal di-update:
  `git remote set-url origin https://github.com/GSF-001/ARCLUX.git`. Kalau
  push dari sesi/device lain masih pakai URL lama (`arclux` lowercase),
  GitHub auto-redirect tapi mending langsung update remote-nya biar bersih.
- **License badge di README diperbaiki** — sebelumnya campur (badge bilang
  MIT, teks bilang Apache 2.0). Sekarang konsisten Apache 2.0 di keduanya.
- **`packages/incremental/`** (Cell/Query/Database) ditambahin — engine
  incremental computation terinspirasi `salsa-rs/salsa` (bukan port, full
  rewrite TypeScript). **Sudah teruji jalan** lewat `demo.ts` (cache hit,
  recompute berjenjang, early cutoff, cycle detection — semua sesuai
  ekspektasi). **BELUM di-wire ke `pipeline.ts`/`buildIndex.ts`** — masih
  berdiri sendiri, belum dipakai di jalur analisis utama.
  Run demo: `pnpm add -D tsx -w && npx tsx packages/incremental/demo.ts`
  (project ini pakai **pnpm**, bukan npm — ada `pnpm-workspace.yaml`,
  jangan campur `npm i` di sini, bisa bikin error aneh).
- **Graph page udah di-wire ke `GraphViewport`** (composition root lengkap:
  Canvas + Toolbar + Search + Selection + Legend + ContextMenu), bukan
  manggil `GraphCanvas` polos lagi.

### Repo referensi direorganisir ke `~/research/`

Semua repo open source yang di-clone buat referensi sekarang rapi di
`~/research/` (bukan langsung di `~` lagi). Isinya (per pengecekan terakhir):
`bazel`, `biome`, `clack`, `cmdk`, `codeql`, `git`, `knip`,
`language-server-protocol`, `nx`, `rust-analyzer`, `salsa`, `scip`, `sqlite`,
`tree-sitter`, `ts-morph`, `turborepo`. Beberapa masih ada sisa di `~`
langsung juga (`dependency-cruiser`, `eslint`, `git-truck`, `madge`,
`modelcontextprotocol`, `opencode`, `vite`) — belum sempat dirapiin semua
ke satu lokasi.

Kandidat belum dieksplor yang match kebutuhan:
- `scip` → format index kode (Sourcegraph) — relevan buat `indexer/indexSchema.ts`
- `knip` → detector unused code — relevan buat detector yang masih kosong
- `cmdk` → command palette — relevan buat `CommandPalette.tsx`
- `ts-morph` → TS AST manipulation lebih ergonomic — upgrade `parser/typescript/parseTs.ts`
- `rust-analyzer`, `salsa` → cross-check desain `packages/incremental/`

### Progress lain yang kejadian di sesi lain (baru kecatet sekarang)

- `packages/detectors/detectUnusedExports.ts` — **terisi** (168 baris)
- `packages/search/fuzzyScore.ts` — file baru, belum ada di rencana awal
- `packages/parser/python/parsePython.ts` (203 baris) + `highlightPython.ts`
  + `pythonHighlightQuery.ts` — **parser Python mulai dikerjain**
- `apps/web/app/api/file/route.ts` — endpoint baru, belum pernah dibahas di
  sini, perlu dicek isinya ngapain kalau mau dipakai
