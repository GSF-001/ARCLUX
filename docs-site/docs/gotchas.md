---
sidebar_position: 4
---

# Gotcha & Troubleshooting

Kumpulan hal-hal yang udah pernah bikin bingung atau makan waktu debug —
baca ini sebelum mulai debug masalah baru.

### 1. `nodeRequire.resolve()` gak bisa dipercaya di runtime Webpack Next.js

Fungsi ini balikin path **relatif ke lokasi bundle**, bukan absolute
filesystem path. Ini udah bikin bug yang sama dua kali (sekali asli,
sekali regresi pas "cleanup" kode). Kalau butuh resolve path native
asset (`.wasm`, dll) di server-side Next.js code — **jangan pakai
`nodeRequire.resolve()` sama sekali**. Build path dari `process.cwd()`.

### 2. Dev server port suka geser + zombie process numpuk

Kalau `curl`/test dapat response kosong atau aneh, jangan langsung
asumsi itu bug di kode. Cek dulu:

```bash
ps aux | grep node
```

Pastikan kosong sebelum start ulang server, dan pastikan port yang
dites **persis sama** dengan yang muncul di baris `Local:
http://localhost:XXXX` saat server start.

### 3. Selalu `cat` file dulu sebelum patch

Jangan asumsi isi file dari draft/issue/percakapan sebelumnya walau
keliatan "pasti sama" — file bisa udah berubah dari commit/PR lain.

### 4. Error `ArcluxError` di API routes gak otomatis ke-log

Kalau debug error yang gak keliatan di server console, cek dulu apakah
error-handling-nya memang sengaja skip `console.error`.

### 5. Testing lewat `tsx` langsung ≠ testing runtime Next.js

Menjalankan `analyzeRepository`/`buildIndex` langsung lewat `tsx`
**skip total Webpack**. Itu cuma membuktikan logic Node-nya benar,
**bukan** membuktikan jalan di runtime Next.js beneran. Dua-duanya
harus dites terpisah — bug bisa ada di salah satu doang.

### 6. Komponen "typecheck-only, belum diverifikasi visual"

Kalau catatan progres bilang begitu, anggap serius kalau ada bug
report soal komponen itu — walau kodenya "kelihatan" sudah benar saat
dibaca.

### 7. `wasmPath` hardcoded ke struktur pnpm

Lihat halaman [Stack & Environment](./stack.md) — ini bakal patah
kalau pindah package manager.
