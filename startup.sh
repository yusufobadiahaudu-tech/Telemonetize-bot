#!/bin/sh
set -eu
cd /workspace
# :8081 is QA-only — a revive must never inherit a stale built-output preview.
# Called directly, not via npm: no node_modules needed, so nothing to wait for.
node scripts/preview.mjs stop || true
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  :
else
  npm run dev >>/tmp/app-startup.log 2>&1 &
fi
# Money loop cron — retry, warn, kick. /loop remains a manual override.
if ! pgrep -f "telemonetize-loop-cron" >/dev/null 2>&1; then
  (
    echo telemonetize-loop-cron
    while true; do
      sleep 60
      curl -sf -X POST http://127.0.0.1:8080/api/cron/loop >/dev/null 2>&1 || true
    done
  ) >>/tmp/app-startup.log 2>&1 &
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
# Wait briefly for vite to bind.
i=0
while [ "$i" -lt 40 ]; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
    exit 0
  fi
  i=$((i + 1))
  sleep 0.25
done
exit 0
