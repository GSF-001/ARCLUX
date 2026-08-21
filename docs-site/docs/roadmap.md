---
sidebar_position: 5
---

# Roadmap & Prioritas Aktif

## 1. `packages/db/*` — 0%

Belum ada persistence layer sama sekali — schema & store ada, query layer
belum dibangun.

## 2. `packages/cache/CacheProvider.ts` + `memoryCache.ts` — 2/5 masih stub

3 content-hash cache udah wired (fileCache/repositoryCache/graphCache);
CacheProvider + memoryCache belum jelas masih dibutuhin atau nggak.

## 3. True per-file incremental

`packages/incremental` + `watcher` built dan verified standalone, tapi
`buildIndex` masih full rebuild tiap kali (keputusan #6: coarse
`watchRepository` dulu, per-file deferred).

## 4. Migrasi ke `fetchJson()` belum tuntas di `apps/web`

Beberapa komponen (`ImpactSummary`, `GlobalSearch`) masih pakai inline
`fetch()` langsung, belum consume helper `fetchJson()` dari
`lib/api.ts` / `graph.ts`.

## 5. Docs sync berjalan terus

README/ABOUT/CONTEXT/docs-site harus ikut perubahan parser (27 bahasa),
DSL, dan fitur baru tiap PR besar — sesi 08-20 menyinkronkan semuanya ke
keadaan "25+2 bahasa, 20 detector, DSL lengkap".