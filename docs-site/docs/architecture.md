---
sidebar_position: 2
---

# Arsitektur

ARCLUX adalah monorepo dengan `apps/web` (UI) dan sekumpulan `packages/*`
yang framework-agnostic.

## Packages

| Package | Status | Catatan |
|---|---|---|
| `packages/git` | — | Clone & operasi git |
| `packages/parser` | Solid | Per-bahasa: TS/TSX, Python, JS, Go, Java + manifest parsers |
| `packages/indexer` | Solid | `buildIndex`, resolve routes/exports/components/hooks/providers |
| `packages/graph` | Sebagian | `buildDependencyGraph`, `buildImportGraph`, `buildExportGraph` selesai; `buildCallGraph` belum ada |
| `packages/engine` | Solid | `pipeline.ts` — **satu-satunya entry point**: `analyzeRepository` |
| `packages/detectors` | Selesai | 18/18, sudah wired ke `apps/cli/doctor.ts` |
| `packages/impact` | Selesai | 8/8 |
| `packages/repository` | — | |
| `packages/db` | 0% | Belum ada persistence layer sama sekali |
| `packages/cache` | 0% | Ada design conflict yang belum diputusin — lihat [Roadmap](./roadmap.md) |
| `packages/shared/types.ts` | Solid | Kamus tipe wajib dipakai semua package lain |

## `apps/web`

Struktur komponen utama:

- `components/graph/` — `GraphCanvas`, `GraphProvider`, `GraphFocusView`.
  History navigation + expand-on-demand sudah di-fix dan **diverifikasi
  langsung di browser**.
- `components/explorer/`
- `components/workspace/`
- `components/overview/`
- `components/vendor-ui/` — shadcn + aceternity + magic-ui

## Aturan penting soal `pipeline.ts`

`packages/engine/pipeline.ts` adalah **satu-satunya entry point** untuk
menjalankan analisis (`analyzeRepository`). Jangan panggil step
individual dari luar `engine/` — semua orkestrasi harus lewat pipeline
ini biar urutan step dan cleanup (termasuk `cleanupRepository` di
`finally`) tetap konsisten.
