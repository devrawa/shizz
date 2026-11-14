#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[[ -x .venv/bin/python && -d mobile/node_modules ]] || { echo 'Run bash scripts/bootstrap.sh first.'; exit 1; }
pids=()
cleanup() { trap - EXIT INT TERM; for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; wait || true; }
trap cleanup EXIT INT TERM
(cd backend && exec ../.venv/bin/python -m uvicorn shizz.main:app --host 0.0.0.0 --port 8000 --no-proxy-headers --no-access-log) &
pids+=("$!")
(cd mobile && exec node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 --strictPort) &
pids+=("$!")
echo 'Browser preview: http://localhost:5173 — development only. Android needs a trusted HTTPS backend.'
wait -n "${pids[@]}"
