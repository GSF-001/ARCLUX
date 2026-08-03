## What changed

<!-- Ringkas apa yang diubah dan kenapa -->

## How was this verified

<!-- tsc --noEmit doang TIDAK cukup untuk perubahan logic.
Jelaskan cara verifikasi nyata: dijalankan lawan playground/* fixture mana,
atau dev server + curl, dst. Lihat PROGRES.md untuk contoh pola verifikasi
yang dipakai di project ini. -->

## Checklist

- [ ] `npx tsc --noEmit -p apps/web/tsconfig.json` (kalau nyentuh apps/web)
- [ ] Dites lawan minimal 1 fixture di `playground/` (kalau nyentuh parser/detector/pipeline)
- [ ] PROGRES.md diupdate kalau ini mengubah status file yang sebelumnya kosong/stub
- [ ] Tidak menduplikasi file/logic yang sudah ada (cek dulu dengan `grep`/`cat`)
