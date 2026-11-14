#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v python3 >/dev/null || { echo 'Install Python 3.11+ first.'; exit 1; }
command -v node >/dev/null || { echo 'Install Node.js 20+ first.'; exit 1; }
python3 -c 'import sys; assert sys.version_info >= (3,11), "Python 3.11+ required"'
node -e 'if(Number(process.versions.node.split(".")[0])<20) throw Error("Node 20+ required")'
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r backend/requirements.txt
if [[ "${1:-}" == '--dev' ]]; then .venv/bin/python -m pip install -r backend/requirements-dev.txt; fi
(cd mobile && npm ci --no-audit --no-fund)
if [[ ! -f .env ]]; then
  cp .env.example .env
  .venv/bin/python - <<'PY'
from pathlib import Path
import secrets
p = Path('.env')
p.write_text(p.read_text().replace('APP_ACCESS_TOKEN=\n', 'APP_ACCESS_TOKEN=' + secrets.token_urlsafe(36) + '\n'))
PY
  chmod 600 .env
  echo 'Created .env with a private device token. Demo mode remains on.'
fi
bash scripts/build-workers.sh
printf '\nReady. Run: bash scripts/dev.sh\nFor real AI, read docs/SETUP.md before changing DEMO_MODE.\n'
