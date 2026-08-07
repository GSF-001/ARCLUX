#!/usr/bin/env bash
# Usage: scripts/log-progress.sh <category> "<title>" "<body text>"
# category: status-core | status-detectors | status-web | status-infra
#           | status-backlog | bugs | decisions | gotchas | collaborators
#
# Usage: scripts/log-progress.sh close-plan <category> "<old title substring>" "<new update title>" "<update body>"
# Closes out an old "planned/next step" entry: inserts a status-update
# pointer at the top of the old entry, then appends a new dated
# "UPDATE: ... — implemented" entry at the end of the file.
set -euo pipefail

if [ "${1:-}" = "close-plan" ]; then
  if [ "$#" -lt 5 ]; then
    echo "Usage: $0 close-plan <category> \"<old title substring>\" \"<new update title>\" \"<update body>\""
    exit 1
  fi

  CATEGORY="$2"
  OLD_TITLE="$3"
  NEW_TITLE="$4"
  BODY="$5"

  FILE="progres/PROGRES-${CATEGORY}.md"

  if [ ! -f "$FILE" ]; then
    echo "ERROR: $FILE nggak ada. Cek nama kategori."
    exit 1
  fi

  DATE=$(date +%Y-%m-%d)
  FULL_NEW_TITLE="UPDATE: ${NEW_TITLE} — implemented"

  OLD_LINE=$(grep -n "^## .*${OLD_TITLE}" "$FILE" | head -1 | cut -d: -f1 || true)

  if [ -z "$OLD_LINE" ]; then
    echo "ERROR: Nggak ketemu entry dengan judul mengandung: $OLD_TITLE"
    echo "Cek dulu: grep '^## ' $FILE"
    exit 1
  fi

  POINTER_FILE="$FILE" POINTER_LINE="$OLD_LINE" POINTER_DATE="$DATE" POINTER_TITLE="$FULL_NEW_TITLE" python3 << 'PYEOF'
import os

file_path = os.environ["POINTER_FILE"]
old_line_idx = int(os.environ["POINTER_LINE"]) - 1
date = os.environ["POINTER_DATE"]
title = os.environ["POINTER_TITLE"]

with open(file_path, "r") as f:
    lines = f.readlines()

insert_at = old_line_idx + 1
if insert_at < len(lines) and lines[insert_at].strip() == "":
    insert_at += 1

pointer_line = '> **[STATUS UPDATE, ' + date + ']: this plan is now implemented.** See "' + title + '" below.\n\n'
lines.insert(insert_at, pointer_line)

with open(file_path, "w") as f:
    f.writelines(lines)
PYEOF

  {
    echo ""
    echo "## ${DATE} — ${FULL_NEW_TITLE}"
    echo ""
    echo "$BODY"
  } >> "$FILE"

  echo "Pointer ditambahin di atas entry lama (line ~$OLD_LINE) di $FILE"
  echo "Entry baru ditambahin di akhir $FILE:"
  echo "## ${DATE} — ${FULL_NEW_TITLE}"
  exit 0
fi

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <category> \"<title>\" \"<body>\""
  echo "   or: $0 close-plan <category> \"<old title>\" \"<new title>\" \"<body>\""
  echo "Categories: status-core status-detectors status-web status-infra status-backlog bugs decisions gotchas collaborators"
  exit 1
fi

CATEGORY="$1"
TITLE="$2"
BODY="$3"

FILE="progres/PROGRES-${CATEGORY}.md"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE nggak ada. Cek nama kategori."
  exit 1
fi

DATE=$(date +%Y-%m-%d)

{
  echo ""
  echo "## ${DATE} — ${TITLE}"
  echo ""
  echo "$BODY"
} >> "$FILE"

echo "Ditambahkan ke $FILE:"
echo "## ${DATE} — ${TITLE}"
