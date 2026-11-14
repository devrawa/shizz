#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PYTHON="${PYTHON:-$ROOT/.venv/bin/python}"
[[ -x "$PYTHON" ]] || PYTHON=python3
(cd backend && "$PYTHON" -m pytest -q && "$PYTHON" -m ruff check shizz tests)
(cd mobile && npm run build)
for script in scripts/*.sh; do bash -n "$script"; done
if command -v go >/dev/null; then (cd workers/fetchguard && go test ./... && go vet ./...); else echo 'SKIPPED: Go tests; Go not installed.'; fi
if command -v cargo >/dev/null; then (cd workers/secretguard && cargo test --locked); else echo 'SKIPPED: Rust tests; Rust not installed.'; fi
