---
sidebar_position: 3
---

# Stack & Environment

## Monorepo

- `apps/web` — Next.js 16, App Router, pakai **Webpack**, bukan
  Turbopack (Turbopack gak support Termux arm64)
- `packages/*` — framework-agnostic
- Package manager: **pnpm** (bukan npm)

## Parsing & graph

- Parsing TS/TSX: TypeScript Compiler API
- Parsing bahasa lain (Python, dkk): `web-tree-sitter`
- Render graph: SVG + `d3-force`

## Environment development

Development dilakukan di **Termux (Android)**. Beberapa konsekuensi:

- Gak ada `/tmp` — pakai `~` (home directory) sebagai gantinya di semua
  path temporary
- `wasmPath` untuk tree-sitter saat ini **hardcoded** ke struktur pnpm:
  `node_modules/.pnpm/tree-sitter-wasms@VERSION/...` — ini bakal patah
  kalau project pindah ke npm/yarn

## Kalau mau kontribusi

Pastikan `pnpm` terpasang, bukan `npm`/`yarn`, karena resolusi path
tree-sitter dan beberapa asumsi build bergantung ke struktur folder
pnpm di `node_modules/.pnpm/`.
