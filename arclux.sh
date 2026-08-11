#!/usr/bin/env bash
# arclux.sh — toolkit sehari-hari buat kerja di ARCLUX.
# Cara pakai: bash arclux.sh <perintah>
#
# Perintah yang ada:
#   status      posisi lu sekarang (branch, commit, sudah push apa belum)
#   diff        test arclux diff HEAD~1 HEAD
#   verify      test arclux verify apps/web
#   doctor      test arclux doctor apps/web
#   typecheck   jalanin tsc --noEmit di apps/web
#   commit "pesan"   git add -A + commit dengan pesan itu (nanya konfirmasi dulu)
#   push        push branch aktif ke origin (nanya konfirmasi dulu)
#   help        tampilin daftar ini lagi

set -e
cd ~/arclux

cmd="${1:-help}"

case "$cmd" in

  status)
    echo "════════════════════════════════════════"
    echo " Branch aktif:"
    git branch --show-current
    echo ""
    echo " Perubahan belum di-commit:"
    git status -s
    if [ -z "$(git status -s)" ]; then echo "  (bersih)"; fi
    echo ""
    echo " 6 commit terakhir:"
    git log --oneline -6
    echo ""
    echo " Sudah di-push ke GitHub?"
    branch=$(git branch --show-current)
    if git log "origin/$branch" --oneline -1 >/dev/null 2>&1; then
      local_hash=$(git rev-parse HEAD)
      remote_hash=$(git rev-parse "origin/$branch")
      if [ "$local_hash" = "$remote_hash" ]; then
        echo "  YA — local dan GitHub sinkron"
      else
        echo "  SEBAGIAN — branch ada di GitHub tapi ada commit local yang belum ke-push"
      fi
    else
      echo "  BELUM — branch '$branch' belum ada di origin"
    fi
    ;;

  diff)
    npx tsx apps/cli/index.ts diff HEAD~1 HEAD .
    ;;

  verify)
    npx tsx apps/cli/index.ts verify apps/web
    ;;

  doctor)
    npx tsx apps/cli/index.ts doctor apps/web
    ;;

  typecheck)
    cd apps/web
    npx tsc --noEmit -p tsconfig.json 2>&1 | head -80
    cd ~/arclux
    echo "(kosong di atas = bersih, gak ada error)"
    ;;

  commit)
    msg="$2"
    if [ -z "$msg" ]; then
      echo "Pakai: bash arclux.sh commit \"pesan commit lu\""
      exit 1
    fi
    git add -A
    echo "--- File yang bakal di-commit ---"
    git status -s
    read -p "Lanjut commit? (y/n) " confirm
    if [ "$confirm" = "y" ]; then
      git commit -m "$msg"
    else
      echo "Batal."
    fi
    ;;

  push)
    branch=$(git branch --show-current)
    echo "Mau push branch '$branch' ke GitHub (origin)."
    echo "main TIDAK kesentuh — ini push ke branch terpisah."
    read -p "Lanjut push? (y/n) " confirm
    if [ "$confirm" = "y" ]; then
      git push -u origin "$branch"
    else
      echo "Batal."
    fi
    ;;

  help|*)
    echo "Perintah yang ada:"
    echo "  bash arclux.sh status              — posisi lu sekarang"
    echo "  bash arclux.sh diff                 — test arclux diff"
    echo "  bash arclux.sh verify               — test arclux verify"
    echo "  bash arclux.sh doctor               — test arclux doctor"
    echo "  bash arclux.sh typecheck            — cek tsc bersih apa nggak"
    echo "  bash arclux.sh commit \"pesan\"       — git add -A + commit"
    echo "  bash arclux.sh push                 — push branch aktif ke GitHub"
    ;;

esac
