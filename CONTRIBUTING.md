# Contributing to ARCLUX

## Branch naming

- `split/...` — memecah file besar jadi lebih kecil
- `fix/...` — perbaikan bug/kesalahan
- `update/...` — update konten/dokumentasi tanpa perubahan struktur besar
- `feat/...` — fitur/tooling baru

## PR workflow

`main` dikunci branch protection — semua perubahan wajib lewat PR, nggak bisa push langsung.

1. `git checkout -b <tipe>/<deskripsi-singkat>`
2. Kerjain perubahan
3. Update `progres/PROGRES-*.md` yang relevan pakai `scripts/log-progress.sh <kategori> "judul" "isi"`
4. `git push origin <branch>`
5. Buka PR di GitHub, isi checklist di template
6. Merge dari GitHub setelah direview

## Menentukan kategori PROGRES

Lihat "quick decision guide" di `PROGRES.md` root.
