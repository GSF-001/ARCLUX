#!/usr/bin/env bash
# Usage: scripts/log-progress.sh <category> "<title>" "<body text>" ["<status>"]
# category: status-core | status-detectors | status-web | status-infra
#           | status-backlog | bugs | decisions | gotchas | collaborators
# status (optional, 4th arg): Not Started | In Progress | Done -- defaults
#           to "Not Started" if omitted. Only meaningful for decisions/status
#           entries that describe planned work, but allowed on any category.
#
# Usage: scripts/log-progress.sh close-plan <category> "<old title substring>" "<new update title>" "<update body>"
# Closes out an old "planned/next step" entry: inserts a status-update
# pointer at the top of the old entry, then appends a new dated
# "UPDATE: ... — implemented" entry (Status: Done) at the end of the file.
#
# Usage: scripts/log-progress.sh set-status <category> "<title substring>" "<new status>"
# Updates the Status: line of an existing entry in place, without touching
# the rest of the entry. Use this to move something from "Not Started" to
# "In Progress" to "Done" as work happens, instead of writing new entries
# each time.
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

  FILE="progres/${CATEGORY}.md"

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
    echo "**Status:** Done"
    echo ""
    echo "$BODY"
  } >> "$FILE"

  echo "Pointer ditambahin di atas entry lama (line ~$OLD_LINE) di $FILE"
  echo "Entry baru ditambahin di akhir $FILE:"
  echo "## ${DATE} — ${FULL_NEW_TITLE}"
  exit 0
fi

if [ "${1:-}" = "set-status" ]; then
  if [ "$#" -lt 4 ]; then
    echo "Usage: $0 set-status <category> \"<title substring>\" \"<new status>\""
    echo "Status biasanya salah satu dari: Not Started | In Progress | Done"
    exit 1
  fi

  CATEGORY="$2"
  TITLE_MATCH="$3"
  NEW_STATUS="$4"

  FILE="progres/${CATEGORY}.md"

  if [ ! -f "$FILE" ]; then
    echo "ERROR: $FILE nggak ada. Cek nama kategori."
    exit 1
  fi

  MATCH_LINE=$(grep -n "^## .*${TITLE_MATCH}" "$FILE" | head -1 | cut -d: -f1 || true)

  if [ -z "$MATCH_LINE" ]; then
    echo "ERROR: Nggak ketemu entry dengan judul mengandung: $TITLE_MATCH"
    echo "Cek dulu: grep '^## ' $FILE"
    exit 1
  fi

  STATUS_FILE="$FILE" STATUS_LINE="$MATCH_LINE" STATUS_NEW="$NEW_STATUS" python3 << 'PYEOF'
import os
import re

file_path = os.environ["STATUS_FILE"]
header_idx = int(os.environ["STATUS_LINE"]) - 1
new_status = os.environ["STATUS_NEW"]

with open(file_path, "r") as f:
    lines = f.readlines()

# Look for an existing "**Status:** ..." line within the next 5 lines after
# the header (skipping blank lines and blockquote pointers).
found_status_line = None
for i in range(header_idx + 1, min(header_idx + 6, len(lines))):
    if re.match(r"^\*\*Status:\*\*", lines[i]):
        found_status_line = i
        break

if found_status_line is not None:
    lines[found_status_line] = "**Status:** " + new_status + "\n"
else:
    # No status line yet -- insert one right after the header (and after
    # a blank line if present, and after any blockquote pointer block).
    insert_at = header_idx + 1
    if insert_at < len(lines) and lines[insert_at].strip() == "":
        insert_at += 1
    while insert_at < len(lines) and lines[insert_at].startswith(">"):
        insert_at += 1
        if insert_at < len(lines) and lines[insert_at].strip() == "":
            insert_at += 1
    lines.insert(insert_at, "**Status:** " + new_status + "\n\n")

with open(file_path, "w") as f:
    f.writelines(lines)
PYEOF

  echo "Status di-update jadi \"$NEW_STATUS\" untuk entry di line ~$MATCH_LINE di $FILE"
  exit 0
fi

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <category> \"<title>\" \"<body>\" [\"<status>\"]"
  echo "   or: $0 close-plan <category> \"<old title>\" \"<new title>\" \"<body>\""
  echo "   or: $0 set-status <category> \"<title>\" \"<new status>\""
  echo "Categories: status-core status-detectors status-web status-infra status-backlog bugs decisions gotchas collaborators"
  exit 1
fi

CATEGORY="$1"
TITLE="$2"
BODY="$3"
STATUS="${4:-Not Started}"

FILE="progres/${CATEGORY}.md"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE nggak ada. Cek nama kategori."
  exit 1
fi

DATE=$(date +%Y-%m-%d)

{
  echo ""
  echo "## ${DATE} — ${TITLE}"
  echo ""
  echo "**Status:** ${STATUS}"
  echo ""
  echo "$BODY"
} >> "$FILE"

echo "Ditambahkan ke $FILE:"
echo "## ${DATE} — ${TITLE}"
echo "Status: ${STATUS}"
