# Hostinger production tag swap

Production is `https://editforge.online` on a Hostinger VPS running
`compose.hostinger.yaml`. Images are immutable GHCR tags. This repo does not
auto-deploy that host on merge.

The GitHub Action `Deploy EditForge to Hostinger` is the Grok-reachable
deploy path. It SSHs to the VPS and runs `scripts/hostinger-tag-swap.sh`.
There is no Hostinger connector on Grok.

## Law

- Manual `workflow_dispatch` only. A push to `main` does not deploy the VPS.
- `dry_run` defaults to true.
- Live apply requires `confirm` to equal `image_tag` and `dry_run=false`.
- Volumes, `.env`, and Caddy data stay put. Only the three GHCR image pins move.
- Failed pull, `up`, or health probe restores the previous compose file and
  recreates from that backup.

## One-time secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Purpose |
|--------|---------|
| `EDITFORGE_VPS_HOST` | VPS hostname or IP |
| `EDITFORGE_VPS_USER` | SSH user that can run `docker compose` |
| `EDITFORGE_VPS_SSH_KEY` | Private key only. Never commit it. |
| `EDITFORGE_COMPOSE_DIR` | Directory on the VPS that holds the compose file |

Optional:

| Secret | Default |
|--------|---------|
| `EDITFORGE_VPS_PORT` | `22` |
| `EDITFORGE_COMPOSE_FILE` | `compose.hostinger.yaml` |
| `EDITFORGE_HEALTH_URL` | `https://editforge.online/api/health` |
| `EDITFORGE_VPS_SSH_KNOWN_HOSTS` | `ssh-keyscan` if unset |

Create a GitHub Environment named `production` and add a required reviewer if
you want a second human gate in the Actions UI.

The deploy key must be able to pull GHCR on the box the same way the current
manual deploys do. This workflow does not log the VPS into GHCR.

## Dispatch

1. Publish images: workflow `Publish EditForge images` with `source_sha`.
2. Dry run: `Deploy EditForge to Hostinger` with `image_tag` and `confirm`
   both set to the 12-character tag, `dry_run=true`.
3. Live: same inputs with `dry_run=false`.
4. Confirm `https://editforge.online/api/health` answers.

Grok can trigger those workflows after you say so in-session. Grok cannot
invent the SSH key or the compose directory.

## Local check

```bash
bash scripts/test_hostinger_tag_swap.sh
bash scripts/hostinger-tag-swap.sh \
  --compose-file compose.hostinger.yaml \
  --tag 648c73d83e74 \
  --dry-run
```
