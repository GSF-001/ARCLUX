# ARCLUX Quickstart

## Alur kerja
git checkout main
git pull origin main
git checkout -b tipe/nama-branch
git add file
git commit -m "pesan"
git push origin tipe/nama-branch
gh pr create --repo GSF-001/ARCLUX --title "judul" --body "penjelasan"
gh pr merge NOMOR --repo GSF-001/ARCLUX --merge --delete-branch
git checkout main
git pull origin main

## Catat progress
Pakai script, jangan edit file progres manual.
scripts/log-progress.sh kategori "judul singkat" "isi progress"

Kategori: status-core, status-detectors, status-web, status-infra, status-backlog, bugs, decisions, gotchas, collaborators

Kenapa wajib pakai script: ada pre-commit hook yang nolak commit kalau entry baru gak ada tanggalnya.

## Sebelum kerjain file yang keliatan kosong
npx tsx scripts/checkCollaboratorMarkers.ts

Jalanin dulu, biar tau file itu udah ada yang pegang atau belum.

## 3 hal yang paling sering lupa
1. Jangan lupa update progres sebelum lanjut task lain.
2. Cek apps/web pakai tsconfig sendiri: cd apps/web && npx tsc --noEmit
3. /tmp gak ada di Termux. Taro script sementara di dalam repo, hapus lagi setelah dipakai.
