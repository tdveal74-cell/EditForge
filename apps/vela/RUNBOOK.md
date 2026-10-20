# Vela on srv1936199

Vela sits beside EditForge. It does not replace it.

Host: `srv1936199` (`editforge.online`).
Door: GitHub workflow `Deploy Vela beside EditForge` in `tdveal74-cell/EditForge`.
Manual `workflow_dispatch` only. A push to `main` does not install Vela.

## Law

- `dry_run` defaults to true.
- A live install requires `confirm` to equal `vela` and `dry_run=false`.
- Do not stop, recreate, or retag `editforge-web`, `editforge-worker`, `editforge-provider`, or `editforge-edge`.
- Do not edit `/opt/editforge` or the live Caddyfile. Other hostnames on `editforge.online` stay as they are.
- Do not touch `srv1936193`. That box is n8n.
- Vela listens on `127.0.0.1:8090` only. It is not a public hostname until a Caddy site is added on purpose.
- The copy of this file on the box is `/opt/vela/RUNBOOK.md`.

## Dispatch

```bash
gh workflow run deploy-vela.yml --ref main -f confirm=vela -f dry_run=true
gh workflow run deploy-vela.yml --ref main -f confirm=vela -f dry_run=false
```

Dry run prints the host and the container names. Live install builds image `vela:local`, replaces only a container named `vela`, and curls `http://127.0.0.1:8090/`.

## Secrets

The workflow uses the EditForge Actions secrets already on this repo: `EDITFORGE_VPS_HOST`, `EDITFORGE_VPS_USER`, `EDITFORGE_VPS_SSH_KEY`, `EDITFORGE_COMPOSE_DIR`. It does not read or rewrite the compose file. Optional `EDITFORGE_VPS_PORT` defaults to 22.

GitHub-hosted runners must reach TCP 22. If the Hostinger firewall drops port 22, this door fails the same way an EditForge deploy fails.
