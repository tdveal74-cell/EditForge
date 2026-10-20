#!/bin/bash
# Install Vela beside EditForge. Never touches /opt/editforge or other containers.
set -euo pipefail

mode="${1:-dry-run}"
dest=/opt/vela
if [[ "$dest" == /opt/editforge || "$dest" == /opt/editforge/* ]]; then
  echo "refusing to write EditForge" >&2
  exit 1
fi

echo "host $(hostname)"
if command -v docker >/dev/null 2>&1; then
  docker ps --format '{{.Names}}' | sort
else
  echo "docker is not installed" >&2
  exit 1
fi

if [[ "$mode" == "dry-run" ]]; then
  echo "dry-run: would install Vela at ${dest} on 127.0.0.1:8090"
  echo "will not change /opt/editforge, Caddy, or any container except one named vela"
  exit 0
fi

if [[ "$mode" != "apply" ]]; then
  echo "unknown mode: ${mode}" >&2
  exit 1
fi

if [[ ! -f /tmp/vela-src.tgz ]]; then
  echo "missing /tmp/vela-src.tgz" >&2
  exit 1
fi

mkdir -p "$dest"
find "$dest" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -xzf /tmp/vela-src.tgz -C "$dest"
if [[ -f /tmp/VELA_RUNBOOK.md ]]; then
  cp /tmp/VELA_RUNBOOK.md "$dest/RUNBOOK.md"
fi
docker build -t vela:local "$dest"
if docker ps -a --format '{{.Names}}' | grep -qx vela; then
  docker rm -f vela
fi
docker run -d --name vela --restart unless-stopped -p 127.0.0.1:8090:8090 vela:local
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf -o /dev/null --max-time 3 http://127.0.0.1:8090/; then
    echo "vela answers on 127.0.0.1:8090"
    exit 0
  fi
  sleep 3
done
echo "vela container is up but port 8090 did not answer" >&2
docker logs vela 2>&1 | tail -n 40 >&2
exit 1
