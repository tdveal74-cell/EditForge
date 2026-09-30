#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SCRIPT="$ROOT/scripts/hostinger-tag-swap.sh"
FIX=$(mktemp)
TEMPLATE=$(mktemp)
trap 'rm -f "$FIX" "$TEMPLATE" "$FIX.bak."*' EXIT

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

cat >"$TEMPLATE" <<'YAML'
services:
  web:
    image: ghcr.io/tdveal74-cell/editforge-web:111111111111
    environment:
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-release-client}
  worker:
    image: ghcr.io/tdveal74-cell/editforge-worker:111111111111
  provider:
    image: ghcr.io/tdveal74-cell/editforge-provider:111111111111
YAML

bash "$SCRIPT" --compose-file "$FIX" --tag 'not-a-sha' --dry-run >/tmp/swap-bad.out 2>/tmp/swap-bad.err && {
  echo "expected invalid tag to fail" >&2
  exit 1
}

DRY_OUTPUT=$(bash "$SCRIPT" --compose-file "$FIX" --tag 648c73d83e74 --dry-run)
grep -q 'web=20e8e04697d6' <<<"$DRY_OUTPUT"
grep -q 'dry-run' <<<"$DRY_OUTPUT"
grep -q '20e8e04697d6' "$FIX"

bash "$SCRIPT" --compose-file "$FIX" --tag 648c73d83e74 --no-compose
grep -q 'editforge-web:648c73d83e74' "$FIX"
grep -q 'editforge-worker:648c73d83e74' "$FIX"
grep -q 'editforge-provider:648c73d83e74' "$FIX"
grep -q 'caddy:2.10.2-alpine' "$FIX"
grep -qv 'editforge-web:20e8e04697d6' "$FIX"

bash "$SCRIPT" --compose-file "$FIX" --compose-template "$TEMPLATE" --tag b00ab77829bb --no-compose
grep -q 'editforge-web:b00ab77829bb' "$FIX"
grep -q 'GOOGLE_CLIENT_ID' "$FIX"

echo "test_hostinger_tag_swap: ok"
