#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SCRIPT="$ROOT/scripts/hostinger-tag-swap.sh"
FIX=$(mktemp)
trap 'rm -f "$FIX" "$FIX.bak."*' EXIT

cat >"$FIX" <<'YAML'
services:
  web:
    image: ghcr.io/tdveal74-cell/editforge-web:20e8e04697d6
  worker:
    image: ghcr.io/tdveal74-cell/editforge-worker:20e8e04697d6
  provider:
    image: ghcr.io/tdveal74-cell/editforge-provider:20e8e04697d6
  edge:
    image: caddy:2.10.2-alpine
YAML

bash "$SCRIPT" --compose-file "$FIX" --tag 'not-a-sha' --dry-run >/tmp/swap-bad.out 2>/tmp/swap-bad.err && {
  echo "expected invalid tag to fail" >&2
  exit 1
}

bash "$SCRIPT" --compose-file "$FIX" --tag 648c73d83e74 --dry-run | grep -q 'web=20e8e04697d6'
bash "$SCRIPT" --compose-file "$FIX" --tag 648c73d83e74 --dry-run | grep -q 'dry-run'
grep -q '20e8e04697d6' "$FIX"

bash "$SCRIPT" --compose-file "$FIX" --tag 648c73d83e74 --no-compose
grep -q 'editforge-web:648c73d83e74' "$FIX"
grep -q 'editforge-worker:648c73d83e74' "$FIX"
grep -q 'editforge-provider:648c73d83e74' "$FIX"
grep -q 'caddy:2.10.2-alpine' "$FIX"
grep -qv 'editforge-web:20e8e04697d6' "$FIX"

echo "test_hostinger_tag_swap: ok"
