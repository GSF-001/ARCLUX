#!/bin/bash
# e2e verification for issue #347 (ARCLUX daemon at runtime)
REPO="D:/Project/456789"
ROOT_DIR="${USERPROFILE}/.arclux"
echo "=== 1. clean any stale daemon state ==="
rm -rf "$ROOT_DIR/daemons" "$ROOT_DIR/endpoints" 2>/dev/null

echo "=== 2. start daemon (detach) ==="
npx tsx apps/cli/index.ts daemon "$REPO" --detach 2>&1 | tail -3
echo "detach command exit: $?"

echo "=== 3. wait for endpoint file + bridge ==="
PORT=""
for i in $(seq 1 60); do
  ENDPOINT_FILE=$(ls "$ROOT_DIR"/endpoints/*.json 2>/dev/null | head -1)
  if [ -n "$ENDPOINT_FILE" ]; then
    PORT=$(node -e "console.log(require(process.argv[1]).port)" "$ENDPOINT_FILE" 2>/dev/null)
    break
  fi
  sleep 1
done
echo "endpoint file: ${ENDPOINT_FILE:-MISSING} | port: ${PORT:-unknown}"
if [ -z "$PORT" ]; then echo "BRIDGE NOT UP"; cat "$ROOT_DIR"/daemons/*.log 2>/dev/null | tail -20; exit 1; fi

echo "=== 4. GET /analysis (initial analysis may take ~30s) ==="
curl -s --max-time 120 "http://127.0.0.1:$PORT/analysis" | head -c 300
echo ""

echo "=== 5. GET /diagnostics ==="
curl -s --max-time 60 "http://127.0.0.1:$PORT/diagnostics" | head -c 200
echo ""

echo "=== 6. GET /events (SSE, 8s window) ==="
timeout 8 curl -s -N "http://127.0.0.1:$PORT/events" 2>/dev/null | head -c 400
echo ""
echo "--- (SSE stream captured above; ': connected' + event lines expected) ---"

echo "=== 7. daemon --status ==="
npx tsx apps/cli/index.ts daemon "$REPO" --status 2>&1 | tail -2

echo "=== 8. daemon --stop ==="
npx tsx apps/cli/index.ts daemon "$REPO" --stop 2>&1 | tail -2

echo "=== 9. verify stopped: /analysis should fail, --status none ==="
curl -s --max-time 5 "http://127.0.0.1:$PORT/analysis" 2>&1 | head -c 80 || echo "(connection refused - OK)"
echo ""
npx tsx apps/cli/index.ts daemon "$REPO" --status 2>&1 | tail -1

echo "=== 10. daemon log tail ==="
tail -8 "$ROOT_DIR"/daemons/*.log 2>/dev/null
echo "DAEMON_E2E_DONE"
