# Hostinger production tag swap

Production is `https://editforge.online` on a Hostinger VPS. Live compose on
the box is `compose.yaml` with GHCR image pins. This repo does not auto-deploy
that host on merge.

One door for every agent that already has GitHub: workflow
`Deploy EditForge to Hostinger`. Grok, Claude Code, and Codex all dispatch that
job. Do not give each agent a private SSH or Hostinger-API path.

## Law

- Manual `workflow_dispatch` only. A push to `main` does not deploy the VPS.
- `dry_run` defaults to true.
- Live apply requires `confirm` to equal `image_tag` and `dry_run=false`.
- Volumes, `.env`, and Caddy data stay put. Only the three GHCR image pins move.
- Failed pull, `up`, or health probe restores the previous compose file and
  recreates from that backup.

## Agents

| Agent | How it deploys |
|-------|----------------|
| Grok | GitHub `workflow_dispatch` after an in-session OK |
| Claude Code | `gh workflow run` or GitHub MCP, same workflow |
| Codex | same |

Hostinger MCP stays available for VPS inspection. It is not the deploy door.

## One-time secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Purpose |
|--------|---------|
| `EDITFORGE_VPS_HOST` | VPS hostname or IP |
| `EDITFORGE_VPS_USER` | SSH user that can run `docker compose` |
| `EDITFORGE_VPS_SSH_KEY` | Private key only. Never commit it. |
| `EDITFORGE_COMPOSE_DIR` | Directory on the VPS that holds `compose.yaml` |

Optional:

| Secret | Default |
|--------|---------|
| `EDITFORGE_VPS_PORT` | `22` |
| `EDITFORGE_COMPOSE_FILE` | `compose.yaml` |
| `EDITFORGE_HEALTH_URL` | `https://editforge.online/api/health` |
| `EDITFORGE_VPS_SSH_KNOWN_HOSTS` | `ssh-keyscan` if unset |

Create a GitHub Environment named `production` and add a required reviewer if
you want a second human gate in the Actions UI.

The VPS user must already be able to pull GHCR. This workflow does not log the
box into GHCR.

## Dispatch

```bash
gh workflow run deploy-hostinger.yml \
  --ref main \
  -f image_tag=648c73d83e74 \
  -f confirm=648c73d83e74 \
  -f dry_run=true
```

1. Publish images: `Publish EditForge images` with `source_sha`.
2. Dry run the command above.
3. Live: same inputs with `dry_run=false`.
4. Confirm `https://editforge.online/api/health` answers.

No agent invents the SSH key or compose directory. Those live only in Actions
secrets.

## Local check

```bash
bash scripts/test_hostinger_tag_swap.sh
```
