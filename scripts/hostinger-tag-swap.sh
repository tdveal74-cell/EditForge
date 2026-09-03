#!/usr/bin/env bash
# Rewrite EditForge GHCR tags in the Hostinger compose file, then optionally
# pull and recreate. Never touches volumes, .env, or Caddy data.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: hostinger-tag-swap.sh --tag <12-hex> --compose-file <path> [options]

  --tag TAG                 Immutable 12-char git short SHA published to GHCR
  --compose-file PATH       Host compose file (usually compose.hostinger.yaml)
  --dry-run                 Print current and target tags; do not write
  --apply                   Write tags, pull, and recreate (default if not dry-run)
  --no-compose              Rewrite the file only; skip docker compose
  --health-url URL          Public health probe after apply
  --health-timeout SECONDS  Probe budget (default 120)
  --rollback-file PATH      Restore this backup instead of applying a new tag
EOF
}

TAG=""
COMPOSE_FILE=""
DRY_RUN=0
APPLY=0
NO_COMPOSE=0
HEALTH_URL=""
HEALTH_TIMEOUT=120
ROLLBACK_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --compose-file) COMPOSE_FILE="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --apply) APPLY=1; shift ;;
    --no-compose) NO_COMPOSE=1; shift ;;
    --health-url) HEALTH_URL="${2:-}"; shift 2 ;;
    --health-timeout) HEALTH_TIMEOUT="${2:-}"; shift 2 ;;
    --rollback-file) ROLLBACK_FILE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$COMPOSE_FILE" ]]; then
  echo "error: --compose-file is required" >&2
  exit 2
fi
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "error: compose file not found: $COMPOSE_FILE" >&2
  exit 2
fi

if [[ -n "$ROLLBACK_FILE" ]]; then
  if [[ ! -f "$ROLLBACK_FILE" ]]; then
    echo "error: rollback file not found: $ROLLBACK_FILE" >&2
    exit 2
  fi
else
  if [[ ! "$TAG" =~ ^[0-9a-f]{12}$ ]]; then
    echo "error: --tag must be a 12-character lowercase hex git short SHA" >&2
    exit 2
  fi
fi

if [[ "$DRY_RUN" -eq 1 && "$APPLY" -eq 1 ]]; then
  echo "error: --dry-run and --apply cannot both be set" >&2
  exit 2
fi
if [[ "$DRY_RUN" -eq 0 && "$APPLY" -eq 0 && -z "$ROLLBACK_FILE" ]]; then
  APPLY=0
  NO_COMPOSE=1
fi

list_pins() {
  python3 - "$1" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
pat = re.compile(r"ghcr\.io/tdveal74-cell/editforge-(web|worker|provider):([0-9a-f]+)")
found = {svc: tag for svc, tag in pat.findall(text)}
for svc in ("web", "worker", "provider"):
    print(f"{svc}={found.get(svc, 'MISSING')}")
if len(found) != 3:
    sys.exit(3)
PY
}

rewrite_pins() {
  python3 - "$1" "$2" "$3" <<'PY'
import re, sys
src, dest, tag = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(src, encoding="utf-8").read()
pat = re.compile(r"(ghcr\.io/tdveal74-cell/editforge-(?:web|worker|provider):)[0-9a-f]+")
new, n = pat.subn(rf"\g<1>{tag}", text)
if n != 3:
    sys.stderr.write(f"error: expected to rewrite 3 image pins, rewrote {n}\n")
    sys.exit(3)
with open(dest, "w", encoding="utf-8") as fh:
    fh.write(new)
PY
}

echo "compose=$COMPOSE_FILE"
echo "current pins:"
list_pins "$COMPOSE_FILE"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "target tag=$TAG"
  echo "dry-run: no files written, no compose invoked"
  exit 0
fi

COMPOSE_DIR=$(dirname "$COMPOSE_FILE")
COMPOSE_NAME=$(basename "$COMPOSE_FILE")
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="$COMPOSE_FILE.bak.$STAMP"

if [[ -n "$ROLLBACK_FILE" ]]; then
  echo "restoring $ROLLBACK_FILE -> $COMPOSE_FILE"
  cp "$ROLLBACK_FILE" "$COMPOSE_FILE"
else
  echo "target tag=$TAG"
  cp "$COMPOSE_FILE" "$BACKUP"
  echo "backup=$BACKUP"
  rewrite_pins "$COMPOSE_FILE" "$COMPOSE_FILE" "$TAG"
fi

echo "new pins:"
list_pins "$COMPOSE_FILE"

if [[ "$NO_COMPOSE" -eq 1 ]]; then
  echo "compose skipped (--no-compose)"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker not on PATH" >&2
  exit 1
fi

compose() {
  docker compose -f "$COMPOSE_NAME" "$@"
}

rollback() {
  echo "rolling back compose file from $BACKUP" >&2
  if [[ -f "$BACKUP" ]]; then
    cp "$BACKUP" "$COMPOSE_FILE"
    (cd "$COMPOSE_DIR" && compose up -d --remove-orphans) || true
  fi
}

cd "$COMPOSE_DIR"
if ! compose pull web worker provider; then
  rollback
  exit 1
fi
if ! compose up -d --remove-orphans --no-build; then
  rollback
  exit 1
fi

if [[ -n "$HEALTH_URL" ]]; then
  echo "probing $HEALTH_URL"
  deadline=$((SECONDS + HEALTH_TIMEOUT))
  ok=0
  while (( SECONDS < deadline )); do
    if curl -fsS "$HEALTH_URL" >/tmp/editforge-health.json 2>/dev/null; then
      echo "health ok"
      cat /tmp/editforge-health.json
      ok=1
      break
    fi
    sleep 5
  done
  if [[ "$ok" -ne 1 ]]; then
    echo "error: health probe failed within ${HEALTH_TIMEOUT}s" >&2
    rollback
    exit 1
  fi
fi

echo "tag-swap complete"
