#!/usr/bin/env bash
#
# Bring the local DEVON lane up without Docker.
#
#   ./scripts/devon-local-nodocker.sh
#
# Same two services as compose.local.yaml, run as plain Node processes instead
# of containers: the Next.js control plane and the FFmpeg worker. Use this where
# Docker is unavailable or its registry is unreachable, which is the usual case
# inside a sandboxed agent session.
#
# What you give up against compose.local.yaml: container isolation, the pinned
# node:22-bookworm-slim base, and the named volumes. It uses whatever ffmpeg is
# on PATH and writes state under .local-run/. Treat it as a way to exercise and
# verify the lane, not as the way to run a studio people depend on.
#
# Stop it with ./scripts/devon-local-nodocker.sh stop

set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

RUN_DIR="$REPO_DIR/.local-run"
PID_FILE="$RUN_DIR/pids"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
step() { printf "\n\033[38;5;173m[%s/5]\033[0m %s\n" "$1" "$2"; }
ok()   { printf "      \033[38;5;79m*\033[0m %s\n" "$1"; }
warn() { printf "      \033[38;5;179m!\033[0m %s\n" "$1"; }
die()  { printf "\n\033[38;5;203mStopped.\033[0m %s\n\n" "$1"; exit 1; }

stop_stack() {
  if [ -f "$PID_FILE" ]; then
    while read -r pid; do
      [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null && printf "stopped %s\n" "$pid"
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  else
    printf "nothing recorded as running\n"
  fi
}

[ "${1:-}" = "stop" ] && { stop_stack; exit 0; }

secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 24
  elif command -v python3 >/dev/null 2>&1; then python3 -c 'import secrets; print(secrets.token_hex(24))'
  else die "Need openssl or python3 to generate the local tokens."; fi
}

env_value() {
  [ -f .env ] || return 0
  python3 - "$1" <<'PYEOF'
import pathlib, sys
key = sys.argv[1]
for line in pathlib.Path(".env").read_text().splitlines():
    if line.startswith(f"{key}="):
        print(line.split("=", 1)[1].strip())
        break
PYEOF
}

printf "\n"
bold "EditForge — local DEVON lane, without Docker"

# ---------------------------------------------------------------------------
step 1 "Checking the runtime"
# ---------------------------------------------------------------------------
command -v node >/dev/null 2>&1 || die "Node is not installed. Node 22 or newer is required."
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
[ "$NODE_MAJOR" -ge 22 ] || die "Node 22 or newer is required; found $(node --version)."
ok "$(node --version)"
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  ok "ffmpeg and ffprobe on PATH"
else
  warn "ffmpeg or ffprobe missing. The worker will report degraded and refuse"
  warn "renders; /api/health will show executionReady false. Install ffmpeg first"
  warn "if you need more than a boot check."
fi

# ---------------------------------------------------------------------------
step 2 "Your settings"
# ---------------------------------------------------------------------------
# Shares .env with scripts/devon-local.sh on purpose, so the DEVON token stays
# the same whichever runner brought the studio up.
if [ ! -f .env ]; then
  cat > .env <<'ENVEOF'
# EditForge local settings. Private: git ignores this file.
EDITFORGE_PORT=3100
EDITFORGE_PUBLIC_URL=http://localhost:3100
EDITFORGE_ACCESS_PASSWORD=
EDITFORGE_SESSION_SECRET=
EDITFORGE_MCP_TOKEN=
EDITFORGE_WORKER_TOKEN=
EDITFORGE_SOURCE_MEDIA_HOST_DIR=./media
ENVEOF
  ok "Wrote .env"
fi
for key in EDITFORGE_ACCESS_PASSWORD EDITFORGE_SESSION_SECRET EDITFORGE_MCP_TOKEN EDITFORGE_WORKER_TOKEN; do
  if grep -q "^${key}=$" .env 2>/dev/null; then
    python3 - "$key" "$(secret)" <<'PYEOF'
import pathlib, sys
key, value = sys.argv[1], sys.argv[2]
p = pathlib.Path(".env")
lines = p.read_text().splitlines()
for index, line in enumerate(lines):
    if line == f"{key}=":
        lines[index] = f"{key}={value}"
        break
p.write_text("\n".join(lines) + "\n")
PYEOF
    ok "Generated $key"
  fi
done

PORT="$(env_value EDITFORGE_PORT)"; PORT="${PORT:-3100}"
PUBLIC_URL="$(env_value EDITFORGE_PUBLIC_URL)"; PUBLIC_URL="${PUBLIC_URL:-http://localhost:$PORT}"
MCP_TOKEN="$(env_value EDITFORGE_MCP_TOKEN)"
MEDIA_DIR="$(env_value EDITFORGE_SOURCE_MEDIA_HOST_DIR)"; MEDIA_DIR="${MEDIA_DIR:-./media}"
[ -n "$MCP_TOKEN" ] || die "EDITFORGE_MCP_TOKEN is empty in .env. Set it or delete the line and re-run."

mkdir -p "$RUN_DIR/data" "$RUN_DIR/artifacts" "$RUN_DIR/worker" "$MEDIA_DIR"
MEDIA_ABS="$(cd "$MEDIA_DIR" && pwd)"
ok "State under .local-run, source media from $MEDIA_DIR"

# ---------------------------------------------------------------------------
step 3 "Building the control plane"
# ---------------------------------------------------------------------------
[ -d node_modules ] || { printf "      installing dependencies\n"; npm ci >/dev/null 2>&1 || die "npm ci failed."; }
if [ -d .next ] && [ "${REBUILD:-}" != "1" ]; then
  ok ".next already built (REBUILD=1 to force)"
else
  printf "      building, a minute or so\n"
  npm run build >"$RUN_DIR/build.log" 2>&1 || die "Build failed. See .local-run/build.log"
  ok "Built"
fi
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/
cp -R public .next/standalone/

# ---------------------------------------------------------------------------
step 4 "Starting"
# ---------------------------------------------------------------------------
stop_stack >/dev/null 2>&1
set -a; . ./.env; set +a
: > "$PID_FILE"

EDITFORGE_WORK_DIR="$RUN_DIR/worker" \
EDITFORGE_ARTIFACT_DIR="$RUN_DIR/artifacts" \
EDITFORGE_SOURCE_MEDIA_DIR="$MEDIA_ABS" \
EDITFORGE_ARTIFACT_BASE_URL="$PUBLIC_URL/api/artifacts" \
EDITFORGE_CALLBACK_ORIGIN="$PUBLIC_URL" \
PORT=8787 node worker/server.mjs >"$RUN_DIR/worker.log" 2>&1 &
echo $! >> "$PID_FILE"

NODE_ENV=production \
EDITFORGE_DATA_DIR="$RUN_DIR/data" \
EDITFORGE_ARTIFACT_DIR="$RUN_DIR/artifacts" \
EDITFORGE_SOURCE_MEDIA_DIR="$MEDIA_ABS" \
EDITFORGE_WORKER_URL="http://127.0.0.1:8787" \
EDITFORGE_WORKER_CALLBACK_BASE_URL="$PUBLIC_URL" \
EDITFORGE_PUBLIC_URL="$PUBLIC_URL" \
HOSTNAME=127.0.0.1 \
PORT="$PORT" node .next/standalone/server.js >"$RUN_DIR/web.log" 2>&1 &
echo $! >> "$PID_FILE"
ok "worker on 8787, control plane on $PORT"

# ---------------------------------------------------------------------------
step 5 "Waiting for health"
# ---------------------------------------------------------------------------
# Read the body whatever the status: /api/health answers 503 when the store or
# worker is degraded, and a degraded studio that is plainly answering must not
# be reported as one that never came up.
HEALTH=""
for _ in $(seq 1 40); do
  HEALTH="$(curl -sS "http://127.0.0.1:$PORT/api/health" 2>/dev/null)"
  printf '%s' "$HEALTH" | grep -q '"service":"editforge"' && break
  HEALTH=""
  sleep 2
done
[ -n "$HEALTH" ] || die \
"The studio did not answer on http://127.0.0.1:$PORT/api/health.
.local-run/web.log and .local-run/worker.log say why."
ok "Health answered"

if printf '%s' "$HEALTH" | grep -q '"executionReady":true'; then
  ok "Execution ready — the worker is reachable and edits will run"
else
  warn "executionReady is false. Usually ffmpeg is missing; .local-run/worker.log confirms."
fi

cat <<TXT

$(bold "Studio")   $PUBLIC_URL/studio
$(bold "Health")   $PUBLIC_URL/api/health

$(bold "Prove the credential") — /api/health is open, so it proves nothing about
the token. This is the read every DEVON command travels, and it spends nothing:

  curl -sS -H "Authorization: Bearer $MCP_TOKEN" $PUBLIC_URL/api/edits

$(bold "DEVON's .env") — Meta-Supreme-Apex-Genesis-/.env

  EDITFORGE_URL=$PUBLIC_URL
  EDITFORGE_TOKEN=$MCP_TOKEN

Clone voice, full motion and lip sync are absent here exactly as in
compose.local.yaml: no adapter URLs, so those operations fail rather than
silently skipping. Nothing here can spend at a provider.

Stop with:  ./scripts/devon-local-nodocker.sh stop

TXT
