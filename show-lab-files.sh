#!/usr/bin/env bash
# show-lab-files.sh — cat semua file yang dibikin/diubah di LAB 1/2/3
# Cara pakai: bash show-lab-files.sh

files=(
  "packages/diff/types.ts"
  "packages/diff/gitDiff.ts"
  "packages/diff/architecturalDiff.ts"
  "apps/cli/diff.ts"
  "apps/cli/verify.ts"
  "apps/cli/index.ts"
  "packages/engine/pipeline.ts"
  "apps/cli/analyze.ts"
  "apps/cli/config.ts"
  "apps/cli/doctor.ts"
  "apps/cli/graph.ts"
  "apps/cli/impact.ts"
)

for f in "${files[@]}"; do
  echo "════════════════════════════════════════════════════════"
  echo " $f"
  echo "════════════════════════════════════════════════════════"
  if [ -f "$f" ]; then
    cat "$f"
  else
    echo "  (file gak ketemu — mungkin path-nya beda atau kehapus)"
  fi
  echo ""
  echo ""
done
