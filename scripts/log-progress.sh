#!/usr/bin/env bash
# Usage: scripts/log-progress.sh <category> "<title>" "<body text>"
# category: status-core | status-detectors | status-web | status-infra
#           | status-backlog | bugs | decisions | gotchas | collaborators
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <category> \"<title>\" \"<body>\""
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
