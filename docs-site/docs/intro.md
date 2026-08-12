---
sidebar_position: 1
---

# Apa itu ARCLUX

**ARCLUX** adalah tool analisis codebase: clone repo → parse → index →
build dependency graph → visualisasi interaktif di browser.

Filosofi utamanya: **workspace, bukan dashboard**. Istilah-istilah kayak
"HealthScore", "Analytics", atau "Dashboard" sengaja dihindari — ARCLUX
diposisikan sebagai tempat kerja buat ngerti struktur codebase, bukan
tempat liat metrik yang udah jadi.

## Alur kerja singkat

1. Repo di-clone
2. Setiap file di-parse sesuai bahasanya (TS/TSX, Python, JS, Go, Java)
3. Hasil parse di-index — resolve routes, exports, components, hooks,
   providers
4. Dari index itu dibangun dependency graph (import graph, export graph)
5. Graph divisualisasikan secara interaktif — bisa expand-on-demand dan
   navigasi history

## Lisensi

ARCLUX dirilis di bawah **Apache 2.0**. Konsekuensi kecil tapi penting:
file stub baseline (cuma header lisensi) itu 8 baris, jadi definisi
"file kosong" di codebase ini adalah **≤9 baris**, bukan `== 0`.

Lanjut ke [Arsitektur](./architecture.md) buat liat struktur package-nya.
