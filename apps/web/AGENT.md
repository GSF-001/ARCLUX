# Ini BUKAN Next.js default, dan ini BUKAN app biasa

Sebelum menulis kode apa pun di sini, baca dulu bagian ini. Ini bukan
disclaimer generik — semua poin di bawah pernah jadi sumber bug nyata di
repo ini.

## Runtime & build

- Next.js 16, App Router. **Webpack, bukan Turbopack.** Turbopack tidak
  jalan di arm64 (environment dev repo ini adalah Termux di Android).
  Selalu gunakan `next dev --webpack` / `next build --webpack`, atau
  script `dev`/`build` yang sudah dikonfigurasi di `package.json` —
  jangan tambahkan flag Turbopack ke command apa pun.
- `/tmp` tidak tersedia di environment ini. Jangan asumsikan path itu ada
  saat menulis script atau kode yang menyentuh filesystem sementara.
- Git push butuh Personal Access Token, bukan password akun — kalau
  menyusun instruksi setup, jangan tulis "masukkan password GitHub".

## Struktur repo — jangan langgar batas ini

Ini monorepo: `apps/web` (UI, Next.js) + `packages/*` (logic inti,
framework-agnostic). Aturan keras:

- **Jangan panggil step pipeline individual dari luar `packages/engine/`.**
  Satu-satunya entry point untuk analisis repo adalah
  `analyzeRepository({ repoUrl })` di `packages/engine/pipeline.ts`. Ini
  yang menjaga lifecycle clone/cleanup tetap benar. Memanggil
  `cloneRepository()`, `scanFiles()`, dll langsung dari `apps/web` akan
  merusak lifecycle itu.
- `packages/*` harus tetap framework-agnostic — jangan import apa pun
  dari `apps/web` (React, Next.js API routes, dst) ke dalam `packages/`.
- Graph UI sudah punya composition root: `GraphViewport.tsx`. Kalau perlu
  menampilkan graph, pakai komponen itu — jangan merakit ulang
  `GraphProvider` + `GraphCanvas` secara manual di tempat lain.

## Sebelum menulis file baru

**Selalu `grep`/`cat` dulu untuk memastikan belum ada file lain yang
mengerjakan hal yang sama.** Ini bukan saran generik — repo ini pernah
punya dua file berbeda nama yang duplikat fungsinya
(`graph/resolveAlias.ts` vs `indexer/resolveAliases.ts`) karena ditulis
di sesi kerja berbeda tanpa cek dulu. Salah satunya jadi dead code yang
tidak pernah di-wire ke pipeline. Jangan ulangi ini.

## vendor-ui

Kalau menjalankan `npx shadcn@latest add ...` (termasuk untuk komponen
dari registry Aceternity atau Magic UI), file yang di-generate **sering
mendarat di folder yang salah** (`components/ui/` alih-alih
`vendor-ui/aceternity/` atau `vendor-ui/magic-ui/`). `aliases.ui` di
`components.json` tidak selalu dipatuhi oleh registry pihak ketiga.
Selalu cek lokasi file setelah install, dan pindahkan manual jika perlu.
Detail lengkap: `apps/web/vendor-ui/README.md`.

## Theming

Warna dan token graph sudah didefinisikan di `theme/arclux.json` dan
`theme/graphColors.ts`, termasuk token khusus untuk 6 tipe node
(`file`, `folder`, `external-package`, `route`, `component`, `hook`) dan
4 tipe edge. Jangan hardcode warna baru untuk elemen graph — tambahkan
token di `graphColors.ts` dan referensikan dari sana.

## Status implementasi

Cek `PROGRESS.md` di root repo untuk daftar terkini apa yang sudah
berjalan vs. masih kosong sebelum mengasumsikan sebuah fitur sudah ada.
Banyak file di `packages/` dan `apps/web` masih berupa stub 0 baris.
