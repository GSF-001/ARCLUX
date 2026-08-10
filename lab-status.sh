#!/usr/bin/env bash
# lab-status.sh — peta posisi ARCLUX. READ-ONLY, aman dijalanin kapan aja,
# gak ngubah/nge-push apa pun. Jalanin: bash lab-status.sh

echo "════════════════════════════════════════"
echo " POSISI SEKARANG"
echo "════════════════════════════════════════"
echo "Branch aktif:"
git branch --show-current
echo ""
echo "Status file (uncommitted changes):"
git status -s
if [ -z "$(git status -s)" ]; then echo "  (bersih, gak ada perubahan belum di-commit)"; fi
echo ""

echo "════════════════════════════════════════"
echo " RIWAYAT COMMIT — feat/diff-lab1-mvp"
echo "════════════════════════════════════════"
git log --oneline feat/diff-lab1-mvp -6 2>/dev/null || echo "  branch feat/diff-lab1-mvp gak ketemu di local"
echo ""

echo "════════════════════════════════════════"
echo " SUDAH DI-PUSH KE GITHUB?"
echo "════════════════════════════════════════"
git log origin/feat/diff-lab1-mvp --oneline -1 2>/dev/null \
  && echo "  ^ branch ini ADA di GitHub (origin)" \
  || echo "  branch feat/diff-lab1-mvp BELUM ada di origin (masih local doang)"
echo ""

echo "════════════════════════════════════════"
echo " FILE-FILE PER LAB (cek ada/gak)"
echo "════════════════════════════════════════"
echo "LAB 1 (diff):"
ls -la packages/diff/ apps/cli/diff.ts 2>/dev/null
echo ""
echo "LAB 2 (verify):"
ls -la apps/cli/verify.ts 2>/dev/null
echo ""
echo "LAB 3 (pipeline merge):"
ls -la packages/engine/pipeline.ts 2>/dev/null
echo "  (analyzeLocal.ts harusnya SUDAH GAK ADA, ini normal:)"
ls apps/cli/analyzeLocal.ts 2>/dev/null || echo "  confirmed: analyzeLocal.ts sudah dihapus (sesuai LAB 3)"
echo ""

echo "════════════════════════════════════════"
echo " CATATAN LENGKAP LAB 1/2/3"
echo "════════════════════════════════════════"
echo "Baca: cat progres/decisions.md   (cari header '2026-08-11 — LAB 1/2/3')"
echo ""

echo "════════════════════════════════════════"
echo " COMMAND SIAP PAKAI (copy manual sesuai kebutuhan)"
echo "════════════════════════════════════════"
cat << 'REF'

--- Pindah / cek branch ---
git branch                              # lihat semua branch
git checkout feat/diff-lab1-mvp         # pindah ke branch LAB
git checkout main                       # balik ke main

--- Test LAB 1 (diff) ---
npx tsx apps/cli/index.ts diff HEAD~1 HEAD .
npx tsx apps/cli/index.ts diff HEAD~5 HEAD .

--- Test LAB 2 (verify) ---
npx tsx apps/cli/index.ts verify apps/web

--- Test LAB 3 tidak langsung (doctor pakai pipeline.ts yang sama) ---
npx tsx apps/cli/index.ts doctor apps/web

--- Typecheck sebelum commit apapun ---
cd apps/web && npx tsc --noEmit -p tsconfig.json 2>&1 | head -80 && cd ~/arclux

--- Commit progress ---
git add -A
git status                              # CEK DULU sebelum commit
git commit -m "pesan commit"

--- Push branch LAB ke GitHub (bukan ke main) ---
git push -u origin feat/diff-lab1-mvp

--- Kalau mau bikin PR review ke main setelah push ---
# buka github.com/GSF-001/ARCLUX, GitHub bakal nawarin "Compare & pull request"

REF
