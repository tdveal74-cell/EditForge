# Using EditForge inside Claude

There are three ways in, and they stack rather than compete. Most setups want
the connector plus the skill.

| Layer | What it gives you | Where it works |
|---|---|---|
| **MCP connector** | Claude can *call* the studio — read cuts and jobs, judge a grade, submit provider work | claude.ai, Claude Desktop, Claude Code |
| **Skill** | Claude knows the house standard and applies it without being told each time | claude.ai (Skills), Claude Code |
| **Plugin** | Bundles the skill, the connector, and slash commands as one install | Claude Code |

The connector gives Claude *hands*. The skill gives it *judgment*. Without the
skill, Claude can call the tools but will happily suggest a grade the envelope
would reject; without the connector, it knows the standard but cannot see your
actual studio.

---

## 1. The MCP connector

The server is part of the app — no separate service to run. It lives at:

```
https://editforge.vercel.app/api/mcp
```

**Add it on claude.ai:** Settings → Connectors → Add custom connector, and paste
that URL.

**Add it in Claude Code:**

```bash
claude mcp add --transport http editforge https://editforge.vercel.app/api/mcp
```

**Against a local studio:** this repository's `.mcp.json` reads the address from
`EDITFORGE_MCP_URL` and falls back to the hosted deployment when it is unset.
Export it, with the token, before starting Claude Code:

```bash
export EDITFORGE_MCP_URL=http://localhost:3100/api/mcp
export EDITFORGE_MCP_TOKEN=<the local studio's token>
```

`docs/LOCAL_OPERATION.md` covers bringing that studio up.

### Authentication, and why writes are gated

Read tools are open. The two tools that change state — `submit_media_job` and
`drive_job` — are not, because a public endpoint that can spend your provider
budget is not something to ship and hope nobody finds.

Set a token on the deployment:

```bash
# Generate one; do not reuse a token from anywhere else.
openssl rand -hex 32
```

Add it in the Vercel dashboard as `EDITFORGE_MCP_TOKEN` (Project → Settings →
Environment Variables), then **redeploy** — environment variables only reach new
deployments. Send it from the client as a bearer token.

Until that variable is set, the write tools are not listed and not callable **by
anyone**. It fails closed on purpose: no token configured means no write access,
rather than open write access.

### When the client cannot send a header

Some MCP clients only accept a URL — there is no field to put an
`Authorization` header in. For those, the same token works as a query
parameter:

```
https://editforge.vercel.app/api/mcp?key=YOUR_TOKEN
```

Paste that as the whole connector URL and it authenticates exactly as the
header does.

### If the connector cannot reach the app at all

Two things sit in front of `/api/mcp`, and both fail before any EditForge code
runs — so the symptom is not an EditForge error message.

**Vercel Authentication.** When it is enabled for "all except custom domains",
every request to `*.vercel.app` is bounced by Vercel's edge unless it carries a
Vercel SSO session. A browser signed into the account gets through; an MCP client
never does. `Project → Settings → Deployment Protection` shows the current
setting. Two ways out: attach a custom domain (protection skips those), or turn
Vercel Authentication off and let the app's own gate do the work —
`EDITFORGE_ACCESS_PASSWORD` makes the whole deployment private and
`EDITFORGE_MCP_TOKEN` gates the write tools, which is what they are for. Do not
turn it off without setting at least one of those first.

**Client-side egress rules.** Some Claude environments only reach an allowlist of
hosts. A `403` on `CONNECT editforge.vercel.app:443`, or a connector that reports
a rejected `Authorization` header without the app ever logging a request, is that
— not a bad token. Add the host to the environment's network settings.

Either way, `curl -s https://<your-deployment>/api/health` from the machine
running the client is the fastest test: if that does not answer with EditForge's
own JSON, the connector was never going to work, and no token will fix it.

This is deliberately the weaker option. URLs are recorded in server and proxy
logs where headers usually are not, so a token sent this way should be treated
as more exposed and rotated more readily. Prefer the header wherever the client
offers one. The URL token authenticates **only** `/api/mcp` — it will not
unlock the rest of the app, so it cannot become a shareable link to a private
studio.

### Interaction with the access gate

`EDITFORGE_ACCESS_PASSWORD` makes the whole deployment private, and that
includes `/api/mcp`. The two variables are independent, but the combination
matters:

| `ACCESS_PASSWORD` | `MCP_TOKEN` | What the connector can do |
|---|---|---|
| unset | unset | Read tools only; no billable work by anyone |
| unset | set | Everything, with the bearer token |
| set | unset | **Nothing — not even reads.** The gate needs a credential and there is none for MCP |
| set | set | Everything, with the bearer token |

The third row is the one that surprises: turning on the access password without
also setting an MCP token takes the connector offline entirely. Set both if you
want a private studio that Claude can still reach.

### What the gate does not do

The login route is not rate-limited, so a weak access password is brute-forcible
by anyone who can reach the deployment. Use a generated value
(`openssl rand -hex 32`), not something memorable — you type it once per browser.

When the access gate is off, the non-billable write routes (`POST /api/cuts`,
and the poll/complete/retry/cancel actions on `/api/jobs/[id]`) remain open.
They cannot spend money, but anyone reaching the deployment could disturb job
and cut state. Turning on the access password closes them too.

### Tools

| Tool | Reads or writes | What it does |
|---|---|---|
| `editforge_status` | read | Active store, reachability, which providers could bill |
| `check_restraint_grade` | read | Judges grade parameters against the restraint envelope |
| `restraint_rubric` | read | The checklist, or evaluates results against it |
| `plan_transcode` | read | Proxy or master ffmpeg plan, with the rubric gate applied |
| `list_cuts` · `get_cut` | read | What is in the studio |
| `list_jobs` · `get_job` | read | State of provider work |
| `submit_media_job` | **write** | Starts provider work — **can bill real money** |
| `drive_job` | **write** | poll · complete · retry · cancel |

The gates hold through MCP exactly as they do in the UI: `plan_transcode`
refuses a master export without a rubric pass, `submit_media_job` refuses
rubric-gated work without a passing decision, and an illegal state transition
comes back as a refusal rather than a crash.

Nothing in this server returns a credential value. `editforge_status` reports
the variable *name* and whether it is set — the same rule `/api/health`
follows, and there is a test asserting a configured key cannot appear in the
response.

---

## 2. The skill

`skills/editforge/SKILL.md` carries the house standard: the five rubric checks,
the grade envelope, the sound hierarchy, and the rule that the gate is the
product rather than an obstacle to route around.

**On claude.ai:** upload the `skills/editforge` folder in Settings → Capabilities
→ Skills.

**In Claude Code:** it loads automatically from this repo, or copy the folder to
`~/.claude/skills/` to have it everywhere.

---

## 3. The plugin (Claude Code)

The plugin bundles the skill, the connector, and two slash commands.

```bash
/plugin marketplace add tdveal74-cell/EditForge
/plugin install editforge@editforge
```

Commands it adds:

- `/rubric` — walk a cut through the restraint rubric and report whether it may
  ship, with the smallest change that would flip a failure
- `/render` — submit provider work through the gates, with the spend stated
  before anything is submitted

---

## Verifying it works

```bash
curl -s https://editforge.vercel.app/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -40
```

Without a bearer token you should see the read tools and **not**
`submit_media_job`. With a valid token, all of them.

A quick end-to-end check that costs nothing:

```bash
curl -s https://editforge.vercel.app/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"check_restraint_grade","arguments":{"exposure":0.45}}}'
```

That grade is outside the envelope, so the response should say so.
