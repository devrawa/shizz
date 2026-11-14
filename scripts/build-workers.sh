#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/workers/bin"
if command -v go >/dev/null; then
  (cd "$ROOT/workers/fetchguard" && go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o ../bin/fetchguard .)
else
  echo 'Go unavailable: using the DNS-pinned Python fetcher. Install Go 1.23+ to build fetchguard.'
fi
if command -v cargo >/dev/null; then
  (cd "$ROOT/workers/secretguard" && cargo test --locked && cargo build --release --locked)
  cp "$ROOT/workers/secretguard/target/release/secretguard" "$ROOT/workers/bin/secretguard"
else
  echo 'Rust unavailable: using Python secret-pattern matching. Install stable Rust to build secretguard.'
fi
