---
sidebar_position: 5
---

# Roadmap & Prioritas Aktif

## 1. `packages/db/*` — 0%

Belum ada persistence layer sama sekali.

## 2. `packages/cache/*` — 0%, ada design conflict

Strategi `MetadataStrategy` (berbasis git-diff) butuh clone repo yang
persisten. Masalahnya, `pipeline.ts` selalu menghapus clone setelah
selesai lewat `cleanupRepository` di blok `finally`.

Dua opsi yang lagi dipertimbangkan:

- **Opsi A** — ubah lifecycle clone jadi persisten
- **Opsi B** — pakai `ContentStrategy` (file-hash) dulu sebagai
  jembatan sementara

Belum diputuskan mana yang jalan duluan.

## 3. Relative import Python 2+ level belum ketest

Pattern seperti `from ..utils import X` kemungkinan belum ke-resolve
dengan benar di `resolvePath.ts`.

## 4. Zero test coverage untuk `parsePython.ts`

Parser Go dan Rust sudah punya test, Python belum.

## 5. Silent `catch {}` di `scanFiles.ts`

Ada 3 blok `catch {}` diam-diam yang bisa drop file tanpa warning —
kelas bug yang sama dengan masalah wasm: data hilang tanpa ada sinyal
ke pengguna.

## 6. Migrasi ke `fetchJson()` belum tuntas di `apps/web`

Beberapa komponen (`ImpactSummary`, `GlobalSearch`) masih pakai inline
`fetch()` langsung, belum consume helper `fetchJson()` dari
`lib/api.ts` / `graph.ts`.
